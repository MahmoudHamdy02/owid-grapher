import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    autorun,
    action,
    reaction,
    IReactionDisposer,
} from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import { Bounds } from "../clientUtils/Bounds.js"
import { capitalize, getIndexableKeys } from "../clientUtils/Util.js"
import { Grapher } from "../grapher/core/Grapher.js"
import { Admin } from "./Admin.js"
import {
    ChartEditor,
    EditorDatabase,
    Log,
    PostReference,
    ChartRedirect,
    ChartEditorManager,
} from "./ChartEditor.js"
import { EditorBasicTab } from "./EditorBasicTab.js"
import { EditorDataTab } from "./EditorDataTab.js"
import { EditorTextTab } from "./EditorTextTab.js"
import { EditorCustomizeTab } from "./EditorCustomizeTab.js"
import { EditorScatterTab } from "./EditorScatterTab.js"
import { EditorMapTab } from "./EditorMapTab.js"
import { EditorHistoryTab } from "./EditorHistoryTab.js"
import { EditorReferencesTab } from "./EditorReferencesTab.js"
import { SaveButtons } from "./SaveButtons.js"
import { LoadingBlocker } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faMobile } from "@fortawesome/free-solid-svg-icons/faMobile"
import { faDesktop } from "@fortawesome/free-solid-svg-icons/faDesktop"
import {
    VisionDeficiency,
    VisionDeficiencySvgFilters,
    VisionDeficiencyDropdown,
    VisionDeficiencyEntity,
} from "./VisionDeficiencies.js"
import { EditorMarimekkoTab } from "./EditorMarimekkoTab.js"
import { Detail, Topic } from "../grapher/core/GrapherConstants.js"
import { get, has, set } from "lodash"
import { GrapherInterface } from "../grapher/core/GrapherInterface.js"
import { EditorTreemapTab } from "./EditorTreemapTab.js"

@observer
class TabBinder extends React.Component<{ editor: ChartEditor }> {
    dispose!: IReactionDisposer
    componentDidMount(): void {
        //window.addEventListener("hashchange", this.onHashChange)
        this.onHashChange()

        this.dispose = autorun(() => {
            //setTimeout(() => window.location.hash = `#${tab}-tab`, 100)
        })
    }

    componentWillUnmount(): void {
        //window.removeEventListener("hashchange", this.onHashChange)
        this.dispose()
    }

    render(): null {
        return null
    }

    @action.bound onHashChange(): void {
        const match = window.location.hash.match(/#(.+?)-tab/)
        if (match) {
            const tab = match[1]
            if (
                this.props.editor.grapher &&
                this.props.editor.availableTabs.includes(tab)
            )
                this.props.editor.tab = tab
        }
    }
}

function extractDetailsFromSyntax(str: string): [string, string][] {
    const pattern = /\(hover::(\w+)::(\w+)\)/g

    return [...str.matchAll(pattern)].map(([_, category, term]) => [
        category,
        term,
    ])
}

@observer
export class ChartEditorPage
    extends React.Component<{
        grapherId?: number
        newGrapherIndex?: number
        grapherConfig?: any
    }>
    implements ChartEditorManager
{
    @observable.ref grapher = new Grapher()
    @observable.ref database = new EditorDatabase({})
    @observable logs: Log[] = []
    @observable references: PostReference[] = []
    @observable redirects: ChartRedirect[] = []
    @observable allTopics: Topic[] = []
    @observable details: GrapherInterface["details"] = {}

    @observable.ref grapherElement?: JSX.Element

    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable simulateVisionDeficiency?: VisionDeficiency

    async fetchGrapher(): Promise<void> {
        const { grapherId, grapherConfig } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? grapherConfig
                : await admin.getJSON(`/api/charts/${grapherId}.config.json`)
        this.loadGrapherJson(json)
    }

    @observable private _isDbSet = false
    @observable private _isGrapherSet = false
    @computed get isReady(): boolean {
        return this._isDbSet && this._isGrapherSet
    }

    @action.bound private loadGrapherJson(json: any): void {
        this.grapherElement = (
            <Grapher
                {...{
                    ...json,
                    bounds:
                        this.editor?.previewMode === "mobile"
                            ? new Bounds(0, 0, 360, 500)
                            : new Bounds(0, 0, 800, 600),
                    getGrapherInstance: (grapher) => {
                        this.grapher = grapher
                    },
                    dataApiUrlForAdmin:
                        this.context.admin.settings.DATA_API_FOR_ADMIN_UI, // passed this way because clientSettings are baked and need a recompile to be updated
                }}
            />
        )
        this._isGrapherSet = true
    }

    @action.bound private setDb(json: any): void {
        this.database = new EditorDatabase(json)
        this._isDbSet = true
    }

    async fetchData(): Promise<void> {
        const { admin } = this.context
        const json = await admin.getJSON(`/api/editorData/namespaces.json`)
        this.setDb(json)
    }

    async fetchLogs(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${grapherId}.logs.json`)
        runInAction(() => (this.logs = json.logs))
    }

    async fetchRefs(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? []
                : await admin.getJSON(
                      `/api/charts/${grapherId}.references.json`
                  )
        runInAction(() => (this.references = json.references || []))
    }

    async fetchRedirects(): Promise<void> {
        const { grapherId } = this.props
        const { admin } = this.context
        const json =
            grapherId === undefined
                ? []
                : await admin.getJSON(`/api/charts/${grapherId}.redirects.json`)
        runInAction(() => (this.redirects = json.redirects))
    }

    async fetchTopics(): Promise<void> {
        const { admin } = this.context
        const json = await admin.getJSON(`/api/topics.json`)
        runInAction(() => (this.allTopics = json.topics))
    }

    async fetchDetails(): Promise<void> {
        const data = (await this.context.admin.getJSON(`/api/details`)) as {
            details: Detail[]
        }

        runInAction(() => {
            this.details = data.details.reduce(
                (acc, detail) =>
                    set(acc, [detail.category, detail.term], detail),
                {}
            )
        })
    }

    // unvalidated tuples extracted from the subtitle and note fields
    // these may point to non-existent details e.g. ["not_a_real_category", "not_a_real_term"]
    @computed get currentDetailReferences() {
        return {
            subtitle: extractDetailsFromSyntax(this.grapher.subtitle),
            note: extractDetailsFromSyntax(this.grapher.note),
        }
    }

    // the actual Detail objects, indexed by category.term
    @computed get currentlyReferencedDetails(): GrapherInterface["details"] {
        const grapherConfigDetails: GrapherInterface["details"] = {}
        const allReferences = Object.values(this.currentDetailReferences).flat()

        allReferences.forEach((categoryAndTerm) => {
            const detail = get(this.details, categoryAndTerm)
            if (detail) {
                set(grapherConfigDetails, categoryAndTerm, detail)
            }
        })

        return grapherConfigDetails
    }

    @computed get invalidDetailReferences() {
        const keys = getIndexableKeys(this.currentDetailReferences)

        const invalidReferences = keys.reduce(
            (acc, key) => ({
                ...acc,
                [key]: this.currentDetailReferences[key].filter(
                    (path) => !has(this.details, path)
                ),
            }),
            {} as typeof this.currentDetailReferences
        )

        return invalidReferences
    }

    @computed get admin(): Admin {
        return this.context.admin
    }

    @computed get editor(): ChartEditor | undefined {
        if (!this.isReady) return undefined

        return new ChartEditor({ manager: this })
    }

    @action.bound refresh(): void {
        this.fetchGrapher()
        this.fetchDetails()
        this.fetchData()
        this.fetchLogs()
        this.fetchRefs()
        this.fetchRedirects()
        this.fetchTopics()
    }

    disposers: IReactionDisposer[] = []

    componentDidMount(): void {
        this.refresh()

        this.disposers.push(
            reaction(
                () => this.editor && this.editor.previewMode,
                () => {
                    if (this.editor) {
                        localStorage.setItem(
                            "editorPreviewMode",
                            this.editor.previewMode
                        )
                    }
                }
            )
        )

        this.disposers.push(
            reaction(
                () => this.currentlyReferencedDetails,
                (currentlyReferencedDetails = {}) => {
                    this.grapher.details = currentlyReferencedDetails
                }
            )
        )
    }

    // This funny construction allows the "new chart" link to work by forcing an update
    // even if the props don't change
    UNSAFE_componentWillReceiveProps(): void {
        setTimeout(() => this.refresh(), 0)
    }

    componentWillUnmount(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    render(): JSX.Element {
        return (
            <AdminLayout noSidebar>
                <main className="ChartEditorPage">
                    {(this.editor === undefined ||
                        this.editor.currentRequest) && <LoadingBlocker />}
                    {this.editor !== undefined && this.renderReady(this.editor)}
                </main>
            </AdminLayout>
        )
    }

    renderReady(editor: ChartEditor): JSX.Element {
        const { grapher, availableTabs, previewMode } = editor

        return (
            <React.Fragment>
                {!editor.newChartId && (
                    <Prompt
                        when={editor.isModified}
                        message="Are you sure you want to leave? Unsaved changes will be lost."
                    />
                )}
                {editor.newChartId && (
                    <Redirect to={`/charts/${editor.newChartId}/edit`} />
                )}
                <TabBinder editor={editor} />
                <div className="chart-editor-settings">
                    <div className="p-2">
                        <ul className="nav nav-tabs">
                            {availableTabs.map((tab) => (
                                <li key={tab} className="nav-item">
                                    <a
                                        className={
                                            "nav-link" +
                                            (tab === editor.tab
                                                ? " active"
                                                : "")
                                        }
                                        onClick={() => (editor.tab = tab)}
                                    >
                                        {capitalize(tab)}
                                        {tab === "refs" &&
                                        this.references.length
                                            ? ` (${this.references.length})`
                                            : ""}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="innerForm container">
                        {editor.tab === "basic" && (
                            <EditorBasicTab editor={editor} />
                        )}
                        {editor.tab === "text" && (
                            <EditorTextTab editor={editor} />
                        )}
                        {editor.tab === "data" && (
                            <EditorDataTab editor={editor} />
                        )}
                        {editor.tab === "customize" && (
                            <EditorCustomizeTab editor={editor} />
                        )}
                        {editor.tab === "scatter" && (
                            <EditorScatterTab grapher={grapher} />
                        )}
                        {editor.tab === "marimekko" && (
                            <EditorMarimekkoTab grapher={grapher} />
                        )}
                        {editor.tab === "treemap" && (
                            <EditorTreemapTab grapher={grapher} />
                        )}
                        {editor.tab === "map" && (
                            <EditorMapTab editor={editor} />
                        )}
                        {editor.tab === "revisions" && (
                            <EditorHistoryTab editor={editor} />
                        )}
                        {editor.tab === "refs" && (
                            <EditorReferencesTab editor={editor} />
                        )}
                    </div>
                    <SaveButtons editor={editor} />
                </div>
                <div className="chart-editor-view">
                    <figure
                        data-grapher-src
                        style={{
                            filter:
                                this.simulateVisionDeficiency &&
                                `url(#${this.simulateVisionDeficiency.id})`,
                        }}
                    >
                        {this.grapherElement}
                    </figure>
                    <div>
                        <div
                            className="btn-group"
                            data-toggle="buttons"
                            style={{ whiteSpace: "nowrap" }}
                        >
                            <label
                                className={
                                    "btn btn-light" +
                                    (previewMode === "mobile" ? " active" : "")
                                }
                                title="Mobile preview"
                            >
                                <input
                                    type="radio"
                                    onChange={action(
                                        () => (editor.previewMode = "mobile")
                                    )}
                                    name="previewSize"
                                    id="mobile"
                                    checked={previewMode === "mobile"}
                                />{" "}
                                <FontAwesomeIcon icon={faMobile} />
                            </label>
                            <label
                                className={
                                    "btn btn-light" +
                                    (previewMode === "desktop" ? " active" : "")
                                }
                                title="Desktop preview"
                            >
                                <input
                                    onChange={action(
                                        () => (editor.previewMode = "desktop")
                                    )}
                                    type="radio"
                                    name="previewSize"
                                    id="desktop"
                                    checked={previewMode === "desktop"}
                                />{" "}
                                <FontAwesomeIcon icon={faDesktop} />
                            </label>
                        </div>
                        <div
                            className="form-group d-inline-block"
                            style={{ width: 250, marginLeft: 15 }}
                        >
                            Emulate vision deficiency:{" "}
                            <VisionDeficiencyDropdown
                                onChange={action(
                                    (option: VisionDeficiencyEntity) =>
                                        (this.simulateVisionDeficiency =
                                            option.deficiency)
                                )}
                            />
                        </div>
                    </div>

                    {/* Include svg filters necessary for vision deficiency emulation */}
                    <VisionDeficiencySvgFilters />
                </div>
            </React.Fragment>
        )
    }
}
