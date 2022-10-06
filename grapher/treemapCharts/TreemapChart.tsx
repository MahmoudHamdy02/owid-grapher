import React, { SVGProps } from "react"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds.js"
import {
    TooltipProps,
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
    uniq,
} from "../../clientUtils/Util.js"
import { CoreColumn } from "../../coreTable/CoreTableColumns.js"
import {
    autoDetectYColumnSlugs,
    makeSelectionArray,
} from "../chart/ChartUtils.js"
import { NoDataModal } from "../noDataModal/NoDataModal.js"
import { SelectionArray } from "../selection/SelectionArray.js"
import { TreemapRenderStrategy } from "../core/GrapherConstants.js"
import { formatValue } from "../../clientUtils/formatValue.js"
import {
    VerticalColorLegend,
    VerticalColorLegendManager,
} from "../verticalColorLegend/VerticalColorLegend.js"
import { Color } from "../../coreTable/CoreTableConstants.js"
import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import { ColorScaleBin } from "../color/ColorScaleBin.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import {
    ColorScaleConfig,
    ColorScaleConfigDefaults,
} from "../color/ColorScaleConfig.js"
import { TippyIfInteractive } from "../chart/Tippy.js"
import { isDarkColor } from "../color/ColorUtils.js"
import { TreemapTooltip } from "./TreemapTooltip.js"
import { PrimitiveType } from "../../clientUtils/owidTypes.js"

@observer
export class TreemapChart
    extends React.Component<{
        bounds?: Bounds
        manager: TreemapChartManager
    }>
    implements ChartInterface, VerticalColorLegendManager, ColorScaleManager
{
    @observable hoveredBlock: TreemapBlock | undefined = undefined
    // Color currently hovered on the legend
    @observable private hoverColor?: Color
    // Color currently clicked on the legend
    @observable private focusColor?: Color

    colorScale = this.props.manager.colorScaleOverride ?? new ColorScale(this)

    // Tables and chart config
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

    @computed get selectionArray(): SelectionArray {
        return makeSelectionArray(this.manager)
    }

    @computed private get selectedEntityNames(): string[] {
        return this.selectionArray.selectedEntityNames
    }

    // Color config
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

    @computed private get hoverKeys(): string[] {
        const { hoverColor } = this

        const hoverKeys =
            hoverColor === undefined
                ? []
                : uniq(
                      this.series
                          .filter((g) => g.color === hoverColor)
                          .map((g) => g.seriesName)
                  )

        return hoverKeys
    }

    @computed get activeColors(): string[] {
        const { hoverKeys } = this
        const activeKeys = hoverKeys.length > 0 ? hoverKeys : []

        if (!activeKeys.length)
            // No hover means they're all active by default
            return uniq(this.series.map((g) => g.color))

        return uniq(
            this.series
                .filter((g) => activeKeys.indexOf(g.seriesName) !== -1)
                .map((g) => g.color)
        )
    }

    // Vertical legend config
    @computed get legendItems(): ColorScaleBin[] {
        return this.colorScale.legendBins
    }

    @computed get legendTitle(): string | undefined {
        return this.colorScale.legendDescription
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

    @action.bound onLegendMouseOver(color: string): void {
        this.hoverColor = color
    }

    @action.bound onLegendMouseLeave(): void {
        this.hoverColor = undefined
    }

    // When the color legend is clicked, toggle selection fo all associated keys
    @action.bound onLegendClick(): void {
        if (this.hoverColor === undefined) return

        if (!this.activeColors.includes(this.hoverColor)) {
            this.focusColor = undefined
        } else if (this.focusColor === undefined) {
            this.focusColor = this.hoverColor
        } else {
            this.focusColor =
                this.focusColor === this.hoverColor
                    ? undefined
                    : this.hoverColor
        }
    }

    // Treemap chart config
    @computed get yColumn(): CoreColumn {
        return this.transformedTable.get(this.yColumnSlug)
    }

    @computed get yColumnSlug(): string {
        return autoDetectYColumnSlugs(this.manager)[0]
    }

    @computed get yColumnSlugs(): string[] {
        return autoDetectYColumnSlugs(this.manager)
    }

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

    @computed get otherCellIndex(): number | undefined {
        const { series } = this
        for (let i = 0; i < series.length - 2; i++) {
            const forwardSum = sum(
                series.slice(i + 1).map((item) => item.value)
            )
            if (
                series[i].value > forwardSum &&
                forwardSum / this.seriesSum < 0.03
            ) {
                return i + 1
            }
        }
        return undefined
    }

    @computed get otherEntities(): TreemapSeries[] | undefined {
        return this.otherCellIndex
            ? this.series.slice(this.otherCellIndex)
            : undefined
    }

    @computed get otherSeries(): TreemapSeries[] | undefined {
        if (this.otherCellIndex && this.otherEntities) {
            const otherSeries = this.series.slice(0, this.otherCellIndex)
            const block: TreemapSeries = {
                color: "#ffff33",
                seriesName: "Other",
                value: sum(this.otherEntities.map((item) => item.value)),
                time: this.series[0].time,
                label: "Other",
            }
            otherSeries.push(block)
            return otherSeries
        } else {
            return undefined
        }
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

    // Normalize the series values (areas) with respect to the bounds area
    @computed get normalizedSeries(): number[] {
        const { series, seriesSum, bounds } = this
        if (this.otherSeries && !this.manager.renderAllEntities) {
            return this.otherSeries.map((series) => {
                return (
                    (series.value *
                        bounds.height *
                        (bounds.width - this.sidebarWidth)) /
                    seriesSum
                )
            })
        } else {
            return series.map((series) => {
                return (
                    (series.value *
                        bounds.height *
                        (bounds.width - this.sidebarWidth)) /
                    seriesSum
                )
            })
        }
    }

    getAspectRatio(width: number, height: number): number {
        return Math.max(width / height, height / width)
    }

    @computed get seriesSum(): number {
        return sum(this.series.map((item) => item.value))
    }

    @computed get renderStrategy(): string | undefined {
        const { treemapRenderStrategy } = this.manager
        return treemapRenderStrategy
    }

    // Draw one rect block
    drawBlock(
        block: TreemapBlock,
        tooltipProps: TooltipProps
    ): SVGProps<SVGGElement> {
        // Calculate text bounds at default font size
        const { width: textWidth, height: textHeight } = Bounds.forText(
            block.text,
            { fontSize: 14 }
        )

        // If text doesn't fit, lower the font size
        // There could be a more elegant way to write this, instead of hardcoding values
        const widthRatio = textWidth / block.width
        const heightRatio = textHeight / block.height
        const fontSize =
            widthRatio < 0.85 && heightRatio < 0.85
                ? 14
                : widthRatio < 1 && heightRatio < 1
                ? 12
                : widthRatio < 1.15 && heightRatio < 1.15
                ? 10
                : undefined

        const { width: newTextWidth, height: newTextHeight } = Bounds.forText(
            block.text,
            { fontSize: fontSize }
        )

        const isFocused = block.color === this.focusColor
        const isHovered = block.color === this.hoverColor || !this.hoverColor
        const labelColor = isDarkColor(block.color) ? "#fff" : "#000"
        const content = (
            <g>
                <rect
                    x={block.x}
                    y={block.y}
                    width={block.width}
                    height={block.height}
                    fill={block.color}
                    opacity={
                        !this.focusColor
                            ? isHovered
                                ? 0.8
                                : 0.2
                            : isFocused
                            ? 0.8
                            : 0.2
                    }
                    strokeWidth={1}
                    stroke={"#ddd"}
                ></rect>
                {fontSize && (
                    <text
                        x={block.x + (block.width - newTextWidth) / 2}
                        y={block.y + block.height / 2 + newTextHeight / 2}
                        fontSize={fontSize}
                        opacity={
                            !this.focusColor
                                ? isHovered
                                    ? 0.8
                                    : 0.2
                                : isFocused
                                ? 0.8
                                : 0.2
                        }
                        fill={labelColor}
                    >
                        {block.text}
                    </text>
                )}
            </g>
        )
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
                {block.text === "Other" ? (
                    <TippyIfInteractive
                        lazy
                        content={<TreemapChart.tooltip {...tooltipProps} />}
                        hideOnClick={false}
                        isInteractive={true}
                    >
                        {content}
                    </TippyIfInteractive>
                ) : (
                    content
                )}
            </g>
        )
    }

    // Render Strategies
    @computed get horizontalSlice(): SVGProps<SVGGElement>[] {
        let offset = 10
        const { series, bounds } = this
        return series.map((series) => {
            const rect = this.drawBlock(
                {
                    x: offset,
                    y: 0,
                    width:
                        (series.value / this.seriesSum) *
                        (bounds.width - this.sidebarWidth),
                    height: bounds.height,
                    text: series.seriesName,
                    color: series.color,
                },
                this.tooltipProps
            )
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
            const rect = this.drawBlock(
                {
                    x: 10,
                    y: offset,
                    width: bounds.width - this.sidebarWidth,
                    height: (series.value / this.seriesSum) * bounds.height,
                    text: series.seriesName,
                    color: series.color,
                },
                this.tooltipProps
            )
            offset += (series.value / this.seriesSum) * bounds.height
            return rect
        })
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
                // If aspect ratio descreases, continue the loop with the updated ratio
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
            this.otherSeries && !this.manager.renderAllEntities
                ? this.otherSeries
                : this.series,
            this.normalizedSeries
        ).map((block) => {
            return this.drawBlock(block, this.tooltipProps)
        })
    }

    // Tooltip config
    @computed get tooltipProps(): TooltipProps {
        const tooltipProps: TooltipProps = {
            hoveredBlock: this.hoveredBlock,
            manager: this.manager,
            series: this.series,
            yColumn: this.yColumn,
            otherEntities: this.otherEntities,
        }
        return tooltipProps
    }

    private static tooltip(props: TooltipProps): JSX.Element {
        const { hoveredBlock, yColumn, manager, otherEntities } = props

        if (hoveredBlock?.text !== "Other") {
            return <></>
        }

        const tooltipSeries = otherEntities?.slice(0, 8)

        // Only show subset of entities if there are too many to render in tooltip
        // if (tooltipSeries.length > 10) {
        //     const itemIndex = tooltipSeries.findIndex(
        //         (item) => item.seriesName === hoveredBlock?.text
        //     )
        //     tooltipSeries =
        //         itemIndex < 3
        //             ? tooltipSeries.slice(0, 7)
        //             : itemIndex > tooltipSeries.length - 3
        //             ? tooltipSeries.slice(
        //                   tooltipSeries.length - 7,
        //                   tooltipSeries.length
        //               )
        //             : tooltipSeries.slice(itemIndex - 3, itemIndex + 4)
        // }

        return (
            <table style={{ fontSize: "0.9em", lineHeight: "1.4em" }}>
                <tbody>
                    <tr>
                        <td>
                            <strong>
                                {yColumn.formatTime(
                                    manager.endTime ?? Infinity
                                )}
                            </strong>
                        </td>
                        <td></td>
                    </tr>
                    <tr>
                        <td
                            style={{
                                paddingRight: "0.8em",
                            }}
                        >
                            <strong>Other Entities</strong>
                        </td>
                        <td
                            style={{
                                textAlign: "right",
                            }}
                        >
                            <strong>{otherEntities?.length}</strong>
                        </td>
                    </tr>
                    {tooltipSeries?.map((series) => (
                        <tr
                            key={series.seriesName}
                            style={{
                                fontWeight:
                                    series.seriesName === hoveredBlock?.text
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
                    <tr>
                        <td
                            style={{
                                paddingRight: "0.8em",
                            }}
                        >
                            <strong>Total</strong>
                        </td>
                        <td
                            style={{
                                textAlign: "right",
                            }}
                        >
                            <strong>
                                {formatValue(
                                    sum(
                                        otherEntities?.map((item) => item.value)
                                    ),
                                    {}
                                )}
                            </strong>
                        </td>
                    </tr>
                </tbody>
            </table>
        )
    }

    @computed private get formatTooltipValue(): (d: number | string) => string {
        return (d: PrimitiveType): string => {
            return this.yColumn?.formatValueLong(d) ?? ""
        }
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
                {renderStrategy === TreemapRenderStrategy.squarified &&
                    this.squarified}
                <VerticalColorLegend manager={this} />
                {this.hoveredBlock && this.hoveredBlock.text !== "Other" && (
                    <TreemapTooltip
                        timeSeriesTable={this.inputTable}
                        colorScaleManager={this}
                        manager={this.manager}
                        entityName={this.hoveredBlock.text}
                        tooltipTarget={{
                            x: this.hoveredBlock.x,
                            y: this.hoveredBlock.y,
                            featureId: this.hoveredBlock.text,
                        }}
                        formatValue={this.formatTooltipValue}
                    />
                )}
            </g>
        )
    }
}
