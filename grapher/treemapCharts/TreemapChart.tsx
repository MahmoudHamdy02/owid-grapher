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
import { action, computed, observable } from "mobx"
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
import { Tooltip } from "../tooltip/Tooltip.js"
import { formatValue } from "../../clientUtils/formatValue.js"

@observer
export class TreemapChart
    extends React.Component<{
        bounds?: Bounds
        manager: TreemapChartManager
    }>
    implements ChartInterface
{
    @observable isHovered: boolean = false

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

    @action.bound onBlockMouseOver(): void {
        this.isHovered = true
    }

    @action.bound onBlockMouseLeave(): void {
        this.isHovered = false
    }

    // Draw one rect block
    drawBlock(block: TreemapBlock): SVGProps<SVGGElement> {
        const { width: textWidth, height: textHeight } = Bounds.forText(
            block.text
        )
        // Only show text if there is enough space
        const showText =
            textWidth < block.width * 0.85 && textHeight < block.height * 0.85
        return (
            <g
                key={block.text}
                // Commented for now, breaks squarified chart
                // onMouseOver={this.onBlockMouseOver}
                // onMouseLeave={this.onBlockMouseLeave}
            >
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
        let offset = 10
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
                x: 10,
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

    // Normalize the series values (areas) with respect to the bounds area
    @computed get normalizedSeries(): number[] {
        const { series, seriesSum, bounds } = this
        return series.map((series) => {
            return (series.value * bounds.area) / seriesSum
        })
    }

    getAspectRatio(width: number, height: number): number {
        return Math.max(width / height, height / width)
    }

    drawSquarified(
        x: number,
        y: number,
        width: number,
        height: number,
        direction: "vertical" | "horizontal",
        series: TreemapSeries[],
        normalizedSeries: number[]
    ): TreemapBlock[] {
        const { getAspectRatio } = this
        // Full array of blocks to be returned
        const blocks: TreemapBlock[] = []
        // inital properties of the current block
        const initialHeight =
            direction === "vertical" ? height : normalizedSeries[0] / width
        const initialWidth =
            direction === "vertical" ? normalizedSeries[0] / height : width
        let initialAspectRatio = getAspectRatio(initialHeight, initialWidth)
        let currentSum = normalizedSeries[0]
        // normalizedSeries = normalizedSeries.slice(1)
        // series = series.slice(1)
        normalizedSeries.slice(1).some((value, index) => {
            currentSum += value
            const newWidth = currentSum / height
            const newHeight = (height * value) / currentSum
            // const newHeight = direction === "vertical" ? value / newWidth : height
            const newAspectRatio = getAspectRatio(newHeight, newWidth)
            if (newAspectRatio > initialAspectRatio) {
                let yOffset = 0
                currentSum -= value
                series.slice(0, index + 1).map((series, seriesIndex) => {
                    const blockHeight =
                        (height * normalizedSeries[seriesIndex]) / currentSum
                    const rect: TreemapBlock = {
                        x: x,
                        y: y + yOffset,
                        height: blockHeight,
                        width: newWidth,
                        color: "#ccc",
                        text: series.seriesName,
                    }
                    blocks.push(rect)
                    yOffset += blockHeight
                })
                return true
            } else {
                initialAspectRatio = newAspectRatio
            }
            return false
        })
        return [...blocks]

        // return blocks
    }

    @computed get testSquarified(): TreemapBlock[] {
        return this.drawSquarified(
            0,
            0,
            this.bounds.width,
            this.bounds.height,
            "vertical",
            this.series,
            this.normalizedSeries
        )
    }

    @computed get squarified(): SVGProps<SVGGElement>[] {
        console.log(this.bounds.width, this.bounds.height)
        return this.drawSquarified(
            0,
            0,
            this.bounds.width,
            this.bounds.height,
            "vertical",
            this.series,
            this.normalizedSeries
        ).map((block) => {
            return this.drawBlock(block)
        })
    }

    @computed get tooltip(): JSX.Element | undefined {
        if (!this.isHovered) return undefined

        const { series } = this

        return (
            <Tooltip
                id="treemapTooltip"
                tooltipManager={this.manager}
                x={this.bounds.width / 2}
                y={this.bounds.height / 2}
            >
                <table style={{ fontSize: "0.9em", lineHeight: "1.4em" }}>
                    <tbody>
                        <tr>
                            <td>
                                <strong>
                                    {this.yColumn.formatTime(
                                        this.manager.endTime ?? Infinity
                                    )}
                                </strong>
                            </td>
                            <td></td>
                        </tr>
                        {series.map((series) => (
                            <tr key={series.seriesName}>
                                <td
                                    style={{
                                        paddingRight: "0.8em",
                                        fontSize: "0.9em",
                                    }}
                                >
                                    {series.seriesName}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                    {formatValue(series.value, {})}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Tooltip>
        )
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
        const { renderStrategy, tooltip } = this
        return (
            <g className="TreemapChart">
                {renderStrategy === TreemapRenderStrategy.horizonalSlice &&
                    this.horizontalSlice}
                {renderStrategy === TreemapRenderStrategy.verticalSlice &&
                    this.verticalSlice}
                {renderStrategy === TreemapRenderStrategy.squarified &&
                    this.squarified}
                {tooltip}
            </g>
        )
    }
}
