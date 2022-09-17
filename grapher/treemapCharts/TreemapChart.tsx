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
import { computed, observable } from "mobx"
import {
    exposeInstanceOnWindow,
    isEmpty,
    sum,
    sortBy,
    uniq,
    flatten,
    excludeUndefined,
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
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "../verticalColorLegend/VerticalColorLegend.js"
import { Color } from "../../coreTable/CoreTableConstants.js"
import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import { ColorScaleBin } from "../color/ColorScaleBin.js"
import { ColorSchemes } from "../color/ColorSchemes.js"
import { ColorScheme } from "../color/ColorScheme.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import {
    ColorScaleConfig,
    ColorScaleConfigDefaults,
} from "../color/ColorScaleConfig.js"

@observer
export class TreemapChart
    extends React.Component<{
        bounds?: Bounds
        manager: TreemapChartManager
    }>
    implements ChartInterface, VerticalColorLegendManager, ColorScaleManager
{
    @observable hoveredBlock: TreemapBlock | undefined = undefined
    @observable private hoverColor?: Color
    colorScale = this.props.manager.colorScaleOverride ?? new ColorScale(this)

    @computed private get manager(): TreemapChartManager {
        return this.props.manager
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }

    @computed.struct private get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get colorScaleColumn(): CoreColumn {
        return (
            // For faceted charts, we have to get the values of inputTable before it's filtered by
            // the faceting logic.
            this.manager.colorScaleColumnOverride ??
            // We need to use inputTable in order to get consistent coloring for a variable across
            // charts, e.g. each continent being assigned to the same color.
            // inputTable is unfiltered, so it contains every value that exists in the variable.
            this.inputTable.get(this.colorColumnSlug)
        )
    }

    @computed private get hoveredSeriesNames(): string[] {
        const { hoverColor } = this

        const hoveredSeriesNames =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        // if (hoveredSeries !== undefined) hoveredSeriesNames.push(hoveredSeries)

        return hoveredSeriesNames
    }

    @computed get activeColors(): string[] {
        const { hoveredSeriesNames, selectedEntityNames } = this
        const activeKeys = hoveredSeriesNames.concat(selectedEntityNames)

        let series = this.series

        if (activeKeys.length)
            series = series.filter((g) => activeKeys.includes(g.seriesName))

        const colorValues = uniq(flatten(series.map((s) => s.color)))

        return excludeUndefined(
            colorValues.map((color) => this.colorScale.getColor(color))
        )
    }

    @computed private get selectedEntityNames(): string[] {
        return this.selectionArray.selectedEntityNames
    }

    // @computed private get colorsInUse(): Color[] {
    //     const allValues =
    //         this.manager.tableAfterAuthorTimelineAndActiveChartTransform?.get(
    //             this.colorColumnSlug
    //         )?.valuesIncludingErrorValues ?? []
    //     // Need to convert InvalidCell to undefined for color scale to assign correct color
    //     const colorValues = uniq(
    //         allValues.map((value) =>
    //             isNotErrorValue(value) ? value : undefined
    //         )
    //     ) as (string | number)[]
    //     return excludeUndefined(
    //         colorValues.map((colorValue) =>
    //             this.colorScale.getColor(colorValue)
    //         )
    //     )
    // }

    @computed get legendItems(): ColorScaleBin[] {
        return this.colorScale.legendBins
    }

    @computed private get legendDimensions(): VerticalColorLegend {
        return new VerticalColorLegend({ manager: this })
    }

    @computed get maxLegendWidth(): number {
        return this.sidebarMaxWidth
    }

    @computed private get sidebarMinWidth(): number {
        return Math.max(this.bounds.width * 0.1, 60)
    }

    @computed private get sidebarMaxWidth(): number {
        return Math.max(this.bounds.width * 0.2, this.sidebarMinWidth)
    }

    @computed.struct get sidebarWidth(): number {
        const { legendDimensions, sidebarMinWidth, sidebarMaxWidth } = this

        return Math.max(
            Math.min(legendDimensions.width, sidebarMaxWidth),
            sidebarMinWidth
        )
    }

    @computed get legendY(): number {
        return this.bounds.top
    }

    @computed get legendX(): number {
        return this.bounds.right - this.sidebarWidth
    }

    transformTable(table: OwidTable): OwidTable {
        const { selectedEntityNames } = this
        table = table.filterByEntityNames(selectedEntityNames)

        if (this.colorColumnSlug) {
            const tolerance =
                table.get(this.colorColumnSlug)?.display?.tolerance ?? Infinity
            table = table.interpolateColumnWithTolerance(
                this.colorColumnSlug,
                tolerance
            )
            if (this.manager.matchingEntitiesOnly) {
                table = table.dropRowsWithErrorValuesForColumn(
                    this.colorColumnSlug
                )
            }
        }

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

    @computed private get transformedTableFromGrapher(): OwidTable {
        return (
            this.manager.transformedTable ??
            this.transformTable(this.inputTable)
        )
    }

    @computed get transformedTable(): OwidTable {
        let table = this.transformedTableFromGrapher
        table = table.filterByTargetTimes([this.manager.endTime ?? Infinity])
        return table
    }

    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get yColumnSlug(): string {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get colorColumnSlug(): string | undefined {
        return this.manager.colorColumnSlug
    }

    @computed private get colorColumn(): CoreColumn {
        return this.transformedTable.get(this.colorColumnSlug)
    }

    @computed get colorScaleConfig(): ColorScaleConfigDefaults | undefined {
        return (
            ColorScaleConfig.fromDSL(this.colorColumn.def) ??
            this.manager.colorScale
        )
    }

    defaultBaseColorScheme = ColorSchemeName.continents
    defaultNoDataColor = "#959595"

    @computed get series(): TreemapSeries[] {
        const { yColumn } = this
        const series = yColumn.owidRows.map((row, index) => {
            const block: TreemapSeries = {
                color: "#ccc",
                seriesName: row.entityName,
                value: row.value,
                time: row.time,
                label: this.transformedTable.rows[index][this.colorColumn.slug],
            }
            this.assignColorToSeries(row.entityName, block)
            return block
        })
        return sortBy(series, (item) => item.value).reverse()
    }

    private assignColorToSeries(
        entityName: string,
        series: TreemapSeries
    ): void {
        const keyColor = this.transformedTable.getColorForEntityName(entityName)
        if (keyColor !== undefined) series.color = keyColor
        else if (!this.colorColumn.isMissing) {
            const color = this.colorScale.getColor(series.label)
            if (color !== undefined) {
                series.color = color
            }
        }
    }

    @computed get seriesSum(): number {
        return sum(this.series.map((item) => item.value))
    }

    @computed get renderStrategy(): string | undefined {
        const { treemapRenderStrategy } = this.manager
        return treemapRenderStrategy
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
                onMouseOver={() => {
                    this.hoveredBlock = block
                }}
                onMouseLeave={() => {
                    this.hoveredBlock = undefined
                }}
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
                width:
                    (series.value / this.seriesSum) *
                    (bounds.width - this.sidebarWidth),
                height: bounds.height,
                text: series.seriesName,
                color: series.color,
            })
            offset +=
                (series.value / this.seriesSum) *
                (bounds.width - this.sidebarWidth)
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
                width: bounds.width - this.sidebarWidth,
                height: (series.value / this.seriesSum) * bounds.height,
                text: series.seriesName,
                color: series.color,
            })
            offset += (series.value / this.seriesSum) * bounds.height
            return rect
        })
    }

    // Normalize the series values (areas) with respect to the bounds area
    @computed get normalizedSeries(): number[] {
        const { series, seriesSum, bounds } = this
        return series.map((series) => {
            return (
                (series.value *
                    bounds.height *
                    (bounds.width - this.sidebarWidth)) /
                seriesSum
            )
        })
    }

    getAspectRatio(width: number, height: number): number {
        return Math.max(width / height, height / width)
    }

    // This algorithm draws the entities with aspect ratio that approaches 1 (as close to square blocks as possible)
    drawSquarified(
        x: number,
        y: number,
        width: number,
        height: number,
        direction: "vertical" | "horizontal",
        series: TreemapSeries[],
        normalizedSeries: number[]
    ): TreemapBlock[] {
        // Test for break condition
        if (series.length === 0) return []
        if (series.length === 1) {
            const rect: TreemapBlock = {
                x: x,
                y: y,
                width: width,
                height: height,
                color: series[0].color,
                text: series[0].seriesName,
            }
            return [rect]
        }

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
        let blockWidth = 0
        let blockHeight = 0

        // Loop over the series starting from the second entity
        normalizedSeries.slice(1).some((value, index) => {
            // Test the properties of the next block
            currentSum += value
            const newWidth =
                direction === "vertical"
                    ? currentSum / height
                    : (width * value) / currentSum
            const newHeight =
                direction === "vertical"
                    ? (height * value) / currentSum
                    : currentSum / width
            const newAspectRatio = getAspectRatio(newHeight, newWidth)

            // If aspect ratio increases, draw the previous blocks and return true to break out of .some()
            if (newAspectRatio > initialAspectRatio) {
                let yOffset = 0
                let xOffset = 0
                // Reset values back to original
                currentSum -= value
                const newWidth =
                    direction === "vertical"
                        ? currentSum / height
                        : (width * value) / currentSum
                const newHeight =
                    direction === "vertical"
                        ? (height * value) / currentSum
                        : currentSum / width
                series.slice(0, index + 1).map((series, seriesIndex) => {
                    blockHeight =
                        direction === "vertical"
                            ? (height * normalizedSeries[seriesIndex]) /
                              currentSum
                            : newHeight
                    blockWidth =
                        direction === "vertical"
                            ? newWidth
                            : (width * normalizedSeries[seriesIndex]) /
                              currentSum
                    const rect: TreemapBlock = {
                        x: x + xOffset,
                        y: y + yOffset,
                        height: blockHeight,
                        width: blockWidth,
                        color: series.color,
                        text: series.seriesName,
                    }
                    blocks.push(rect)
                    direction === "vertical"
                        ? (yOffset += blockHeight)
                        : (xOffset += blockWidth)
                })
                return true
            } else {
                // If aspect ratio descreases, continue the loop with the updated one
                initialAspectRatio = newAspectRatio
            }
            return false
        })
        // Call the function again on the remaining series entities
        return [
            ...blocks,
            ...this.drawSquarified(
                direction === "vertical" ? x + blockWidth : x,
                direction === "vertical" ? y : y + blockHeight,
                direction === "vertical" ? width - blockWidth : width,
                direction === "vertical" ? height : height - blockHeight,
                direction === "vertical" ? "horizontal" : "vertical",
                series.slice(blocks.length),
                normalizedSeries.slice(blocks.length)
            ),
        ]
    }

    @computed get squarified(): SVGProps<SVGGElement>[] {
        return this.drawSquarified(
            10,
            0,
            this.bounds.width - this.sidebarWidth,
            this.bounds.height,
            "vertical",
            this.series,
            this.normalizedSeries
        ).map((block) => {
            return this.drawBlock(block)
        })
    }

    @computed get tooltip(): JSX.Element | undefined {
        if (!this.hoveredBlock) return undefined

        const { series } = this

        return (
            <Tooltip
                id="treemapTooltip"
                tooltipManager={this.manager}
                x={this.hoveredBlock?.x + this.hoveredBlock.width / 2}
                y={this.hoveredBlock?.y}
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
                            <tr
                                key={series.seriesName}
                                style={{
                                    fontWeight:
                                        series.seriesName ===
                                        this.hoveredBlock?.text
                                            ? "bold"
                                            : undefined,
                                }}
                            >
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
                <VerticalColorLegend manager={this} />
                {tooltip}
            </g>
        )
    }
}
