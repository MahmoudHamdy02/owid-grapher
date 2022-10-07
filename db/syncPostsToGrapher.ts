// Comes in handy when the post update hook fails for some reason, and we need
// to batch update the grapher posts metadata without manually triggering individual WP updates.

import * as wpdb from "./wpdb.js"
import * as db from "./db.js"
import { keyBy } from "../clientUtils/Util.js"
import { PostRow } from "../clientUtils/owidTypes.js"
import { postsTable, select } from "./model/Post.js"

const zeroDateString = "0000-00-00 00:00:00"

const blockRefRegex = /<!-- wp:block \{"ref":(?<id>\d+)\} \/-->/g

interface ReusableBlock {
    ID: number
    post_content: string
}

const fetchAllReusableBlocks = async (): Promise<
    Record<string, ReusableBlock>
> => {
    const blocks: ReusableBlock[] = await wpdb.singleton.query(
        "select ID, post_content from wp_posts where post_type='wp_block' AND post_status = 'publish'"
    )

    const allBlocks = keyBy(blocks, "ID")
    return allBlocks
}

type ReplacerFunction = (
    _match: string,
    _firstPattern: string,
    _offset: number,
    fullString: string,
    matches: Record<string, string>
) => string

/** Function that takes an object where the keys are reusable block ids and the values are
    ReusableBlocks and returns a replacer function that can be used as a replacer when using
    string.replace(regex, replacer_function) to replace matches that capture the id with
    the content of the block from the blocks input param with the same id as the key */
function buildReplacerFunction(
    blocks: Record<string, ReusableBlock>
): ReplacerFunction {
    return (
        _match: string,
        _firstPattern: string,
        _offset: number,
        fullString: string,
        matches: Record<string, string>
    ) => {
        const block = blocks[matches["id"].toString()]
        if (block) return block.post_content
        else return fullString
    }
}

function replaceReusableBlocksRecursive(
    content: string,
    replacerFunction: ReplacerFunction
): string {
    // Resolve references by using replace with a regex and a function.
    // There are two special cases - one is that not all refs resolve (🤨)
    // in which case we leave the original ref comment as is; the second is
    // that some blocks reference other blocks (🎉 recursion!) and so we
    // check in a loop if the regexp still matches and run replace again.
    // Because not all refs resolve we have to limit the number of attempts - for now
    // we try it 3 times which should be plenty for all reasonably sane scenarios
    let contentWithBlocksInlined = content
    for (
        let recursionLevelsRemaining = 3;
        recursionLevelsRemaining > 0 &&
        contentWithBlocksInlined.match(blockRefRegex);
        recursionLevelsRemaining--
    ) {
        contentWithBlocksInlined = contentWithBlocksInlined.replace(
            blockRefRegex,
            replacerFunction
        )
    }
    return contentWithBlocksInlined
}

type BlockResolveFunction = (content: string) => string

/** This function fetches all reusable blocks and then returns a function that
    takes a post content and returns the content with all references to blocks resolved.
    To do its work this function uses a database connection to fetch all blocks when it is called
    that has to be awaited but then the function that is returned is then a simple lookup implementation.
    This was implemented as a closure for nicer re-use and encapsulation.

    @example
    const content = "some content with a <!-- wp:block {\"ref\":123} /--> reference"
    const replacerFn = await buildReusableBlocksResolver()
    const dereferencedContent = replacerFn(content)
     */
export async function buildReusableBlocksResolver(): Promise<BlockResolveFunction> {
    const allBlocks = await fetchAllReusableBlocks()
    const replacerFunction = buildReplacerFunction(allBlocks)
    return (content: string) =>
        replaceReusableBlocksRecursive(content, replacerFunction)
}

const syncPostsToGrapher = async (): Promise<void> => {
    const dereferenceReusableBlocksFn = await buildReusableBlocksResolver()

    const rows = await wpdb.singleton.query(
        "select * from wp_posts where (post_type='page' or post_type='post') AND post_status != 'trash'"
    )

    const doesExistInWordpress = keyBy(rows, "ID")
    const existsInGrapher = await select("id").from(
        db.knexInstance().from(postsTable)
    )
    const doesExistInGrapher = keyBy(existsInGrapher, "id")

    const toDelete = existsInGrapher
        .filter((p) => !doesExistInWordpress[p.id])
        .map((p) => p.id)

    const toInsert = rows.map((post: any) => {
        const content = post.post_content as string

        return {
            id: post.ID,
            title: post.post_title,
            slug: post.post_name.replace(/__/g, "/"),
            type: post.post_type,
            status: post.post_status,
            content: dereferenceReusableBlocksFn(content),
            published_at:
                post.post_date_gmt === zeroDateString
                    ? null
                    : post.post_date_gmt,
            updated_at:
                post.post_modified_gmt === zeroDateString
                    ? "1970-01-01 00:00:00"
                    : post.post_modified_gmt,
        }
    }) as PostRow[]

    await db.knexInstance().transaction(async (t) => {
        if (toDelete.length)
            await t.whereIn("id", toDelete).delete().from(postsTable)

        for (const row of toInsert) {
            if (doesExistInGrapher[row.id])
                await t.update(row).where("id", "=", row.id).into(postsTable)
            else await t.insert(row).into(postsTable)
        }
    })
}

const main = async (): Promise<void> => {
    try {
        await syncPostsToGrapher()
    } finally {
        await wpdb.singleton.end()
        await db.closeTypeOrmAndKnexConnections()
    }
}

main()
