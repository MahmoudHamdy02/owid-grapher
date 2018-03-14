import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, autorun, IReactionDisposer} from 'mobx'
import * as _ from 'lodash'
import {Prompt, Redirect} from 'react-router'
const timeago = require('timeago.js')()

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import Link from './Link'
import { LoadingBlocker, TextField, BindString, Toggle, FieldsRow } from './Forms'
import ChartConfig from '../charts/ChartConfig'
import ChartFigureView from '../charts/ChartFigureView'
import Bounds from '../charts/Bounds'
import ChartList, { ChartListItem } from './ChartList'
import VariableList, { VariableListItem } from './VariableList'

interface SourcePageData {
    id: number
    name: string
    updatedAt: string
    namespace: string
    description: {
        dataPublishedBy?: string
        dataPublisherSource?: string
        link?: string
        retrievedDate?: string
        additionalInfo?: string
    }
    variables: VariableListItem[]
}

class SourceEditable {
    @observable name: string = ""
    @observable description = {
        dataPublishedBy: undefined,
        dataPublisherSource: undefined,
        link: undefined,
        retrievedDate: undefined,
        additionalInfo: undefined
    }

    constructor(json: SourcePageData) {
        for (const key in this) {
            if (key === "description")
                Object.assign(this.description, json.description)
            else if (key in json)
                this[key] = (json as any)[key]
        }
    }
}

@observer
class SourceEditor extends React.Component<{ source: SourcePageData }> {
    @observable newSource!: SourceEditable
    @observable isDeleted: boolean = false

    // Store the original source to determine when it is modified
    componentWillMount() { this.componentWillReceiveProps() }
    componentWillReceiveProps() {
        this.newSource = new SourceEditable(this.props.source)
        this.isDeleted = false
    }

    @computed get isModified(): boolean {
        return JSON.stringify(this.newSource) !== JSON.stringify(new SourceEditable(this.props.source))
    }

    async save() {
        const {source} = this.props
        console.log(this.newSource)
        const json = await this.context.admin.requestJSON(`/api/sources/${source.id}`, { source: this.newSource }, "PUT")

        if (json.success) {
            Object.assign(this.props.source, this.newSource)
        }
    }

    render() {
        const {source} = this.props
        const {newSource} = this
        const isBulkImport = source.namespace !== 'owid'

        return <main className="DatasetEditPage">
            <Prompt when={this.isModified} message="Are you sure you want to leave? Unsaved changes will be lost."/>
            <section>
                <h1>Source: {source.name}</h1>
                <p>Last updated {timeago.format(source.updatedAt)}</p>
            </section>
            <section>
                <form onSubmit={e => { e.preventDefault(); this.save() }}>
                    {isBulkImport && <p>This source is associated with a bulk import, so we can't change it manually.</p>}
                    <BindString field="name" store={newSource} label="Name" disabled={isBulkImport}/>
                    <BindString field="dataPublishedBy" store={newSource.description} label="Data published by" disabled={isBulkImport}/>
                    <BindString field="dataPublisherSource" store={newSource.description} label="Data publisher's source" disabled={isBulkImport}/>
                    <BindString field="link" store={newSource.description} label="Link" disabled={isBulkImport}/>
                    <BindString field="retrievedDate" store={newSource.description} label="Retrieved" disabled={isBulkImport}/>
                    <BindString field="additionalInfo" store={newSource.description} label="Additional information" textarea disabled={isBulkImport}/>
                    <input type="submit" className="btn btn-success" value="Update source"/>
                </form>
            </section>
            <section>
                <h3>Variables</h3>
                <VariableList variables={source.variables}/>
            </section>
        </main>
    }
}

@observer
export default class SourceEditPage extends React.Component<{ sourceId: number }> {
    context!: { admin: Admin }
    @observable source?: SourcePageData

    render() {
        return <AdminLayout title={this.source && this.source.name}>
            {this.source && <SourceEditor source={this.source}/>}
        </AdminLayout>
    }

    async getData() {
        const json = await this.context.admin.getJSON(`/api/sources/${this.props.sourceId}.json`)
        runInAction(() => {
            this.source = json.source as SourcePageData
        })
    }

    componentDidMount() { this.componentWillReceiveProps() }
    componentWillReceiveProps() {
        this.getData()
    }
}
