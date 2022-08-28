import React, { SVGProps } from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import {
    TreemapBlock,
    TreemapChartManager,
    TreemapSeries,
} from "./TreemapChartConstants.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import { computed } from "mobx"
import {
    exposeInstanceOnWindow,
    isEmpty,
    sum,
    sortBy,
} from "../../clientUtils/Util.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import {
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { TreemapRenderStrategy } from "../core/GrapherConstants.js"

@observer
export class TreemapChart
    extends React.Component<{
        bounds?: Bounds
        manager: TreemapChartManager
    }>
    implements ChartInterface
{
    @computed private get manager(): TreemapChartManager {
        return this.props.manager
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    @computed.struct private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    transformTable(table: OwidTable): OwidTable {
        table = table.filterByEntityNames(
            this.selectionArray.selectedEntityNames
        )
        return table
    }

    @computed get failMessage(): string {
        if (this.yColumn.isMissing) return "Missing Y axis variable"

        // if (this.yColumn.isMissing) return "Missing X axis variable"

        // if (isEmpty(this.allEntityNamesWithXAndY)) {
        //     if (
        //         this.manager.isRelativeMode &&
        //         this.manager.hasTimeline &&
        //         this.manager.startTime === this.manager.endTime
        //     ) {
        //         return "Please select a start and end point on the timeline below"
        //     }
        //     return "No entities with data for both X and Y"
        // }

        if (isEmpty(this.series)) return "No matching data"

        return ""
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformTable(this.inputTable)
        table = table.filterByTargetTimes([this.manager.endTime ?? Infinity])
        return table
    }

    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get yColumnSlug(): string {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed get series(): TreemapSeries[] {
        const { yColumn } = this
        const series = yColumn.owidRows.map((row) => ({
            color: "#932834",
            seriesName: row.entityName,
            value: row.value,
            time: row.time,
        }))
        return sortBy(series, (item) => item.value).reverse()
    }

    @computed get seriesSum(): number {
        return sum(this.series.map((item) => item.value))
    }

    @computed get renderStrategy(): string | undefined {
        const { treemapRenderStrategy } = this.manager
        return treemapRenderStrategy
    }

    // Draw one rect block
    drawBlock(block: TreemapBlock): JSX.IntrinsicElements["g"] {
        const { width: textWidth, height: textHeight } = Bounds.forText(
            block.text
        )
        // Only show text if there is enough space
        const showText =
            this.renderStrategy === TreemapRenderStrategy.horizonalSlice
                ? textWidth < block.width * 0.85
                : textHeight < block.height * 0.85
        return (
            <g key={block.text}>
                <rect
                    x={block.x}
                    y={block.y}
                    width={block.width}
                    height={block.height}
                    fill={block.color}
                    strokeWidth={1}
                    stroke={"#444"}
                ></rect>
                {showText && (
                    <text
                        x={block.x + block.width / 2 - textWidth / 2}
                        y={block.y + block.height / 2 + textHeight / 2}
                        fontSize={14}
                    >
                        {block.text}
                    </text>
                )}
            </g>
        )
    }

    // Render Strategies
    @computed get horizontalSlice(): SVGProps<SVGGElement>[] {
        let offset = 0
        const { series, bounds } = this
        return series.map((series) => {
            const rect = this.drawBlock({
                x: offset,
                y: 0,
                width: (series.value / this.seriesSum) * bounds.width,
                height: bounds.height,
                text: series.seriesName,
                color: "#ccc",
            })
            offset += (series.value / this.seriesSum) * bounds.width
            return rect
        })
    }

    @computed get verticalSlice(): SVGProps<SVGGElement>[] {
        let offset = 0
        const { series, bounds } = this
        return series.map((series) => {
            const rect = this.drawBlock({
                x: 0,
                y: offset,
                width: bounds.width,
                height: (series.value / this.seriesSum) * bounds.height,
                text: series.seriesName,
                color: "#ccc",
            })
            offset += (series.value / this.seriesSum) * bounds.height
            return rect
        })
    }

    render(): JSX.Element {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.failMessage}
                />
            )
        const { renderStrategy } = this
        return (
            <g className="TreemapChart">
                {renderStrategy === TreemapRenderStrategy.horizonalSlice &&
                    this.horizontalSlice}
                {renderStrategy === TreemapRenderStrategy.verticalSlice &&
                    this.verticalSlice}
            </g>
        )
    }
}
