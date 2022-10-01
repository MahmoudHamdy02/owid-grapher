import React from "react"
import { useState, useEffect, useRef } from "react"
import ReactDOM from "react-dom"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBars } from "@fortawesome/free-solid-svg-icons/faBars"
import { useTriggerWhenClickOutside } from "./hooks.js"
import { wrapInDiv } from "../clientUtils/Util.js"
import { faTimes } from "@fortawesome/free-solid-svg-icons/faTimes"
import { TocHeading } from "../clientUtils/owidTypes.js"
import classNames from "classnames"

const TOC_WRAPPER_CLASSNAME = "toc-wrapper"

interface TableOfContentsData {
    headings: TocHeading[]
    pageTitle: string
    hideSubheadings?: boolean
}

const isRecordTopViewport = (record: IntersectionObserverEntry) => {
    return (
        record.rootBounds &&
        record.boundingClientRect.top < record.rootBounds.height / 2
    )
}

const getPreviousHeading = (
    nextHeadingRecord: IntersectionObserverEntry | undefined,
    previousHeadings: Array<{ slug: string; previous: string | null }>
) => {
    return previousHeadings.find(
        (heading) => heading.slug === nextHeadingRecord?.target.id
    )?.previous
}

export const TableOfContents = ({
    headings,
    pageTitle,
    hideSubheadings,
}: TableOfContentsData) => {
    const [isOpen, setIsOpen] = useState(false)
    const [activeHeading, setActiveHeading] = useState("")
    const tocRef = useRef<HTMLElement>(null)

    const toggleIsOpen = () => {
        setIsOpen(!isOpen)
    }

    useTriggerWhenClickOutside(tocRef, isOpen, setIsOpen)

    useEffect(() => {
        if ("IntersectionObserver" in window) {
            const previousHeadings = headings.map((heading, i) => ({
                slug: heading.slug,
                previous: i > 0 ? headings[i - 1].slug : null,
            }))

            let currentHeadingRecord: IntersectionObserverEntry | undefined
            let init = true

            const observer = new IntersectionObserver(
                (records) => {
                    let nextHeadingRecord: IntersectionObserverEntry | undefined

                    // Target headings going down
                    currentHeadingRecord = records.find(
                        (record) =>
                            // filter out records no longer intersecting (triggering on exit)
                            record.isIntersecting &&
                            // filter out records fully in the page (upcoming section)
                            record.intersectionRatio !== 1 &&
                            // filter out intersections happening at the bottom of the viewport
                            isRecordTopViewport(record)
                    )

                    if (currentHeadingRecord) {
                        setActiveHeading(currentHeadingRecord.target.id)
                    } else {
                        // Target headings going up
                        nextHeadingRecord = records.find(
                            (record) =>
                                isRecordTopViewport(record) &&
                                record.intersectionRatio === 1
                        )
                        if (nextHeadingRecord) {
                            setActiveHeading(
                                getPreviousHeading(
                                    nextHeadingRecord,
                                    previousHeadings
                                ) || ""
                            )
                        } else if (init) {
                            currentHeadingRecord = records
                                .reverse()
                                .find(
                                    (record) =>
                                        record.boundingClientRect.top < 0
                                )
                            setActiveHeading(
                                currentHeadingRecord?.target.id || ""
                            )
                        }
                    }
                    init = false
                },
                {
                    rootMargin: "-10px", // 10px offset to trigger intersection when landing exactly at the border when clicking an anchor
                    threshold: new Array(11).fill(0).map((v, i) => i / 10),
                }
            )

            let contentHeadings = null
            if (hideSubheadings) {
                contentHeadings = document.querySelectorAll("h2")
            } else {
                contentHeadings = document.querySelectorAll("h2, h3")
            }
            contentHeadings.forEach((contentHeading) => {
                observer.observe(contentHeading)
            })
        }
    }, [headings, hideSubheadings])

    return (
        <div className={TOC_WRAPPER_CLASSNAME}>
            <aside
                className={classNames("entry-sidebar", {
                    "entry-sidebar--is-open": isOpen,
                })}
                ref={tocRef}
            >
                <nav className="entry-toc">
                    <ul>
                        <li>
                            <a
                                onClick={() => {
                                    toggleIsOpen()
                                    setActiveHeading("")
                                }}
                                href="#"
                                data-track-note="toc-header"
                            >
                                {pageTitle}
                            </a>
                        </li>
                        {headings
                            .filter((heading) =>
                                hideSubheadings && heading.isSubheading
                                    ? false
                                    : true
                            )
                            .map((heading, i: number) => (
                                <li
                                    key={i}
                                    className={
                                        (heading.isSubheading
                                            ? "subsection"
                                            : "section") +
                                        (heading.slug === activeHeading
                                            ? " active"
                                            : "")
                                    }
                                >
                                    <a
                                        onClick={toggleIsOpen}
                                        href={`#${heading.slug}`}
                                        data-track-note="toc-link"
                                    >
                                        {heading.text}
                                    </a>
                                </li>
                            ))}
                    </ul>
                </nav>
                <div className="toggle-toc">
                    <button
                        data-track-note="page-toggle-toc"
                        aria-label={`${
                            isOpen ? "Close" : "Open"
                        } table of contents`}
                        onClick={toggleIsOpen}
                    >
                        <FontAwesomeIcon icon={isOpen ? faTimes : faBars} />
                        <span className="label">
                            {isOpen ? "Close" : "Contents"}
                        </span>
                    </button>
                </div>
            </aside>
        </div>
    )
}

export const runTableOfContents = (tocData: TableOfContentsData) => {
    const tocWrapperEl = document.querySelector<HTMLElement>(
        `.${TOC_WRAPPER_CLASSNAME}`
    )
    if (!tocWrapperEl) return

    const sidebarRootEl = wrapInDiv(tocWrapperEl, ["sidebar-root"])
    ReactDOM.hydrate(<TableOfContents {...tocData} />, sidebarRootEl)
}
