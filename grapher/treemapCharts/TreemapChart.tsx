import React from "react"
import { observer } from "mobx-react"
import { Bounds } from "../../clientUtils/Bounds.js"
import { TreemapChartManager, TreemapSeries } from "./TreemapChartConstants.js"
import { ChartInterface } from "../chart/ChartInterface.js"
import { OwidTable } from "../../coreTable/OwidTable.js"
import { computed } from "mobx"

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

    transformTable(table: OwidTable): OwidTable {
        // const { backgroundSeriesLimit, excludedEntities, addCountryMode } =
        //     this.manager

        // if (
        //     addCountryMode === EntitySelectionMode.Disabled ||
        //     addCountryMode === EntitySelectionMode.SingleEntity
        // ) {
        //     table = table.filterByEntityNames(
        //         this.selectionArray.selectedEntityNames
        //     )
        // }

        // if (excludedEntities) {
        //     const excludedEntityIdsSet = new Set(excludedEntities)
        //     table = table.columnFilter(
        //         OwidTableSlugs.entityId,
        //         (entityId) => !excludedEntityIdsSet.has(entityId as number),
        //         `Excluded entity ids specified by author: ${excludedEntities.join(
        //             ", "
        //         )}`
        //     )
        // }

        // Allow authors to limit the # of background entities to get better perf and clearer charts.
        // if (backgroundSeriesLimit) {
        //     const selectedSeriesNames = new Set<SeriesName>(
        //         this.selectionArray.selectedEntityNames
        //     )
        //     // Todo: implement a better strategy for picking the entities to show for context. Maybe a couple per decile?
        //     const backgroundSeriesNames = new Set<SeriesName>(
        //         sampleFrom(
        //             table.availableEntityNames.filter(
        //                 (name) => !selectedSeriesNames.has(name)
        //             ),
        //             backgroundSeriesLimit,
        //             123
        //         )
        //     )
        //     table = table.columnFilter(
        //         table.entityNameSlug,
        //         (name) =>
        //             selectedSeriesNames.has(name as string) ||
        //             backgroundSeriesNames.has(name as string),
        //         `Capped background series at ${backgroundSeriesLimit}`
        //     )
        // }

        // if (this.xScaleType === ScaleType.log && this.xColumnSlug)
        //     table = table.replaceNonPositiveCellsForLogScale([this.xColumnSlug])

        // if (this.yScaleType === ScaleType.log && this.yColumnSlug)
        //     table = table.replaceNonPositiveCellsForLogScale([this.yColumnSlug])

        // if (this.sizeColumnSlug) {
        //     const tolerance =
        //         table.get(this.sizeColumnSlug)?.display?.tolerance ?? Infinity
        //     table = table.interpolateColumnWithTolerance(
        //         this.sizeColumnSlug,
        //         tolerance
        //     )
        // }

        // if (this.colorColumnSlug) {
        //     const tolerance =
        //         table.get(this.colorColumnSlug)?.display?.tolerance ?? Infinity
        //     table = table.interpolateColumnWithTolerance(
        //         this.colorColumnSlug,
        //         tolerance
        //     )
        //     if (this.manager.matchingEntitiesOnly) {
        //         table = table.dropRowsWithErrorValuesForColumn(
        //             this.colorColumnSlug
        //         )
        //     }
        // }

        // We want to "chop off" any rows outside the time domain for X and Y to avoid creating
        // leading and trailing timeline times that don't really exist in the dataset.
        // const [timeDomainStart, timeDomainEnd] = table.timeDomainFor([
        //     this.xColumnSlug,
        //     this.yColumnSlug,
        // ])
        // table = table.filterByTimeRange(
        //     timeDomainStart ?? -Infinity,
        //     timeDomainEnd ?? Infinity
        // )

        // if (this.xOverrideTime !== undefined) {
        //     table = table.interpolateColumnWithTolerance(this.yColumnSlug)
        // } else {
        //     table = table.interpolateColumnsByClosestTimeMatch(
        //         this.xColumnSlug,
        //         this.yColumnSlug
        //     )
        // }

        // Drop any rows which have non-number values for X or Y.
        // This needs to be done after the tolerance, because the tolerance may fill in some gaps.
        // table = table
        //     .columnFilter(
        //         this.xColumnSlug,
        //         isNumber,
        //         "Drop rows with non-number values in X column"
        //     )
        //     .columnFilter(
        //         this.yColumnSlug,
        //         isNumber,
        //         "Drop rows with non-number values in Y column"
        //     )

        // The tolerance application might lead to some data being dropped for some years.
        // For example, if X times are [2000, 2005, 2010], and Y times are [2005], then for all 3
        // rows we have the same match [[2005, 2005], [2005, 2005], [2005, 2005]].
        // This means we can drop 2000 and 2010 from the timeline.
        // It might not make a huge difference here, but it makes a difference when there are more
        // entities covering different time periods.
        // const [originalTimeDomainStart, originalTimeDomainEnd] =
        //     table.originalTimeDomainFor([this.xColumnSlug, this.yColumnSlug])
        // table = table.filterByTimeRange(
        //     originalTimeDomainStart ?? -Infinity,
        //     originalTimeDomainEnd ?? Infinity
        // )

        return table
    }

    @computed get failMessage(): string {
        // if (this.yColumn.isMissing) return "Missing Y axis variable"

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

        // if (isEmpty(this.series)) return "No matching data"

        return ""
    }

    @computed get inputTable(): OwidTable {
        return this.manager.table
    }

    @computed get transformedTable(): OwidTable {
        const table = this.inputTable
        // let table = this.transformedTableFromGrapher
        // if (
        //     this.manager.hideLinesOutsideTolerance &&
        //     this.manager.startTime !== undefined &&
        //     this.manager.endTime !== undefined
        // ) {
        //     const entityNames = Array.from(
        //         intersectionOfSets(
        //             [this.manager.startTime, this.manager.endTime].map(
        //                 (targetTime) =>
        //                     table.filterByTargetTimes([targetTime], 0)
        //                         .availableEntityNameSet
        //             )
        //         )
        //     )
        //     table = table.filterByEntityNames(entityNames)
        // }
        // // We don't want to apply this transform when relative mode is also enabled, it has a
        // // sligthly different endpoints logic that drops initial zeroes to avoid DivideByZero error.
        // if (this.compareEndPointsOnly && !this.manager.isRelativeMode) {
        //     table = table.keepMinTimeAndMaxTimeForEachEntityOnly()
        // }
        // if (this.manager.isRelativeMode) {
        //     table = table.toAverageAnnualChangeForEachEntity([
        //         this.xColumnSlug,
        //         this.yColumnSlug,
        //     ])
        // }
        return table
    }

    @computed get series(): TreemapSeries[] {
        const series: TreemapSeries = {
            color: "",
            label: "",
            seriesName: "",
        }
        return [series]
        // return Object.entries(
        //     groupBy(this.allPointsBeforeEndpointsFilter, (p) => p.entityName)
        // ).map(([entityName, points]) => {
        //     const series: ScatterSeries = {
        //         seriesName: entityName,
        //         label: entityName,
        //         color: "#932834", // Default color, used when no color dimension is present
        //         points,
        //     }
        //     this.assignColorToSeries(entityName, series)
        //     return series
        // })
    }

    render(): JSX.Element {
        return (
            <g className="TreemapChart">
                <text x={10} y={20}>
                    Hello World!
                </text>
            </g>
        )
    }
}
