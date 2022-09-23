import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Tooltip } from "../tooltip/Tooltip.js"
import { MapChartManager } from "./MapChartConstants.js"
import { ColorScale, ColorScaleManager } from "../color/ColorScale.js"
import { Time } from "../../coreTable/CoreTableConstants.js"
import { ChartTypeName } from "../core/GrapherConstants.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import {
    EntityName,
    OwidVariableRow,
} from "../../coreTable/OwidTableConstants.js"
import { LineChart } from "../lineCharts/LineChart.js"
import classNames from "classnames"
import { Bounds } from "../../clientUtils/Bounds.js"
import { LineChartManager } from "../lineCharts/LineChartConstants.js"
import { darkenColorForHighContrastText } from "../color/ColorUtils.js"
import { isNumber, AllKeysRequired } from "../../clientUtils/Util.js"
import { checkIsVeryShortUnit } from "../../clientUtils/formatValue.js"

interface MapTooltipProps {
    entityName: EntityName
    manager: MapChartManager
    colorScaleManager: ColorScaleManager
    formatValue: (d: number | string) => string
    timeSeriesTable: OwidTable
    tooltipTarget: { x: number; y: number; featureId: string }
    targetTime?: Time
    isEntityClickable?: boolean
}

const SPARKLINE_WIDTH = 140
const SPARKLINE_HEIGHT = 60
const SPARKLINE_PADDING = 7

@observer
export class MapTooltip extends React.Component<MapTooltipProps> {
    @computed private get mapColumnSlug(): string | undefined {
        return this.props.manager.mapColumnSlug
    }

    @computed private get mapAndYColumnAreTheSame(): boolean {
        const { yColumnSlug, yColumnSlugs, mapColumnSlug } = this.props.manager
        return yColumnSlugs && mapColumnSlug !== undefined
            ? yColumnSlugs.includes(mapColumnSlug)
            : yColumnSlug === mapColumnSlug
    }

    @computed private get entityName(): EntityName {
        return this.props.entityName
    }

    // Table pre-filtered by targetTime, exlcudes time series
    @computed private get mapTable(): OwidTable {
        const table =
            this.props.manager.transformedTable ?? this.props.manager.table
        return table.filterByEntityNames([this.entityName])
    }

    @computed private get timeSeriesTable(): OwidTable | undefined {
        if (this.mapColumnSlug === undefined) return undefined
        return this.props.timeSeriesTable
            .filterByEntityNames([this.entityName])
            .columnFilter(
                this.mapColumnSlug,
                isNumber,
                "Drop rows with non-number values in Y column"
            )
    }

    @computed private get datum():
        | OwidVariableRow<number | string>
        | undefined {
        return this.mapTable.get(this.mapColumnSlug).owidRows[0]
    }

    @computed private get hasTimeSeriesData(): boolean {
        return this.timeSeriesTable !== undefined
            ? this.timeSeriesTable.numRows > 1
            : false
    }

    @computed private get lineColorScale(): ColorScale {
        const oldManager = this.props.colorScaleManager
        // Make sure all ColorScaleManager props are included.
        // We can't ...rest here because I think mobx computeds aren't
        // enumerable or something.
        const newManager: AllKeysRequired<ColorScaleManager> = {
            colorScaleConfig: oldManager.colorScaleConfig,
            hasNoDataBin: oldManager.hasNoDataBin,
            defaultNoDataColor: oldManager.defaultNoDataColor,
            defaultBaseColorScheme: oldManager.defaultBaseColorScheme,
            colorScaleColumn: oldManager.colorScaleColumn,
        }
        return new ColorScale(newManager)
    }

    @computed private get showSparkline(): boolean {
        return this.hasTimeSeriesData
    }

    @computed private get tooltipTarget(): {
        x: number
        y: number
        featureId: string
    } {
        return (
            this.props.tooltipTarget ?? {
                x: 0,
                y: 0,
                featureId: "Default Tooltip",
            }
        )
    }

    // Line chart fields
    @computed private get sparklineTable(): OwidTable {
        return this.timeSeriesTable ?? new OwidTable()
    }
    @computed private get sparklineManager(): LineChartManager {
        // Pass down short units, while omitting long or undefined ones.
        const unit = this.sparklineTable.get(this.mapColumnSlug).shortUnit
        const yAxisUnit =
            typeof unit === "string"
                ? checkIsVeryShortUnit(unit)
                    ? unit
                    : ""
                : ""

        return {
            table: this.sparklineTable,
            transformedTable: this.sparklineTable,
            yColumnSlug: this.mapColumnSlug,
            colorColumnSlug: this.mapColumnSlug,
            selection: [this.entityName],
            colorScaleOverride: this.lineColorScale,
            hideLegend: true,
            hidePoints: true,
            baseFontSize: 11,
            disableIntroAnimation: true,
            lineStrokeWidth: 3.5,
            annotation: {
                entityName: this.entityName,
                year: this.datum?.time,
            },
            yAxisConfig: {
                hideAxis: false,
                hideGridlines: false,
                tickFormattingOptions: {
                    unit: yAxisUnit,
                    numberAbbreviation: "short",
                },
                // Copy min/max from top-level Grapher config if Y column == Map column
                min: this.mapAndYColumnAreTheSame
                    ? this.props.manager.yAxisConfig?.min
                    : undefined,
                max: this.mapAndYColumnAreTheSame
                    ? this.props.manager.yAxisConfig?.max
                    : undefined,
                ticks: [
                    { value: 0, priority: 1, solid: true },
                    // Show minimum and maximum
                    { value: -Infinity, priority: 2 },
                    { value: Infinity, priority: 2 },
                ],
            },
            xAxisConfig: {
                hideAxis: false,
                hideGridlines: true,
                tickFormattingOptions: {},
                // Always show up to the target time on the X axis,
                // even if there is no data for it.
                min: this.props.targetTime,
                max: this.props.targetTime,
                ticks: [
                    // Show minimum and maximum
                    { value: -Infinity, priority: 1 },
                    { value: Infinity, priority: 1 },
                ],
            },
        }
    }

    render(): JSX.Element {
        const { tooltipTarget, mapTable, datum, lineColorScale } = this
        const { isEntityClickable, targetTime, manager } = this.props

        // Only LineChart and ScatterPlot allow `mapIsClickable`
        const clickToSelectMessage =
            manager.type === ChartTypeName.LineChart
                ? "Click for change over time"
                : "Click to select"

        // TODO simplify?
        const { timeColumn } = mapTable
        const preposition = OwidTable.getPreposition(timeColumn)
        const displayTime = !timeColumn.isMissing
            ? timeColumn.formatValue(targetTime)
            : targetTime
        const displayDatumTime =
            timeColumn && datum
                ? timeColumn.formatValue(datum?.time)
                : datum?.time.toString() ?? ""
        const valueColor: string | undefined = darkenColorForHighContrastText(
            lineColorScale?.getColor(datum?.value) ?? "#333"
        )

        return (
            <Tooltip
                id="mapTooltip"
                tooltipManager={this.props.manager}
                key="mapTooltip"
                x={tooltipTarget.x}
                y={tooltipTarget.y}
                style={{ textAlign: "center", padding: "0.3em" }}
                offsetX={15}
                offsetY={10}
                offsetYDirection={"upward"}
            >
                <div
                    style={{
                        padding: "0.3em",
                        margin: 0,
                        fontWeight: "normal",
                        fontSize: "1em",
                    }}
                >
                    {tooltipTarget.featureId}
                </div>
                <div
                    className="map-tooltip"
                    style={{
                        margin: 0,
                        padding: "0.3em",
                    }}
                >
                    <div className="map-value-with-sparkline">
                        {this.showSparkline && (
                            <div className="sparkline">
                                <svg
                                    className="plot"
                                    width={SPARKLINE_WIDTH}
                                    height={SPARKLINE_HEIGHT}
                                >
                                    <LineChart
                                        manager={this.sparklineManager}
                                        // Add padding so that the edges of the plot doesn't get clipped.
                                        // The plot can go out of boundaries due to line stroke thickness.
                                        bounds={new Bounds(
                                            0,
                                            0,
                                            SPARKLINE_WIDTH,
                                            SPARKLINE_HEIGHT
                                        ).pad({
                                            top: SPARKLINE_PADDING,
                                            left: SPARKLINE_PADDING,
                                            right: SPARKLINE_PADDING,
                                        })}
                                    />
                                </svg>
                            </div>
                        )}

                        <div
                            className={classNames({
                                "value-wrapper": true,
                                "no-plot": !this.showSparkline,
                            })}
                        >
                            <div
                                className="value"
                                style={{ color: valueColor }}
                            >
                                {datum
                                    ? this.props.formatValue(datum.value)
                                    : this.props.formatValue("No data")}
                            </div>
                            <div className="time">
                                {preposition}{" "}
                                {datum ? displayDatumTime : displayTime}
                            </div>
                        </div>
                    </div>
                </div>
                {isEntityClickable && (
                    <div>
                        <p
                            style={{
                                margin: 0,
                                padding: "0.3em",
                                fontSize: "13px",
                                opacity: 0.6,
                            }}
                        >
                            {clickToSelectMessage}
                        </p>
                    </div>
                )}
            </Tooltip>
        )
    }
}
