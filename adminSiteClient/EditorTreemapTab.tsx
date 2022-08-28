import React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"
import { Grapher } from "../grapher/core/Grapher.js"
import { ComparisonLineConfig } from "../grapher/scatterCharts/ComparisonLine.js"
import { SelectField, Section } from "./Forms.js"
import { TreemapRenderStrategy } from "../grapher/core/GrapherConstants.js"

@observer
export class EditorTreemapTab extends React.Component<{ grapher: Grapher }> {
    @observable comparisonLine: ComparisonLineConfig = { yEquals: undefined }

    constructor(props: { grapher: Grapher }) {
        super(props)
    }

    @action.bound onChangeTreemapRenderStrategy(value: string) {
        this.props.grapher.treemapRenderStrategy =
            value as TreemapRenderStrategy
    }

    render() {
        const { grapher } = this.props

        return (
            <div className="EditorTreemapTab">
                <Section name="Render Strategy">
                    <SelectField
                        value={grapher.treemapRenderStrategy}
                        onValue={this.onChangeTreemapRenderStrategy}
                        options={Object.keys(TreemapRenderStrategy).map(
                            (entry) => ({ value: entry })
                        )}
                    />
                </Section>
            </div>
        )
    }
}
