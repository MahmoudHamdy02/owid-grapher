import {
    StackMode,
    GrapherTabOption,
    ScatterPointLabelStrategy,
    RelatedQuestionsConfig,
    EntitySelectionMode,
    ChartTypeName,
    FacetStrategy,
    Detail,
    TreemapRenderStrategy,
} from "./GrapherConstants.js"
import { AxisConfigInterface } from "../axis/AxisConfigInterface.js"
import { TimeBound } from "../../clientUtils/TimeBounds.js"
import { ComparisonLineConfig } from "../scatterCharts/ComparisonLine.js"
import { LogoOption } from "../captionedChart/Logos.js"
import { ColorScaleConfigInterface } from "../color/ColorScaleConfig.js"
import { MapConfigWithLegacyInterface } from "../mapCharts/MapConfig.js"
import { ColumnSlugs, Time } from "../../coreTable/CoreTableConstants.js"
import { EntityId, EntityName } from "../../coreTable/OwidTableConstants.js"
import { ColorSchemeName } from "../color/ColorConstants.js"
import { QueryParams } from "../../clientUtils/urls/UrlUtils.js"
import { OwidChartDimensionInterface } from "../../clientUtils/OwidVariableDisplayConfigInterface.js"
import { ColumnSlug, SortConfig, TopicId } from "../../clientUtils/owidTypes.js"

// This configuration represents the entire persistent state of a grapher
// Ideally, this is also all of the interaction state: when a grapher is saved and loaded again
// under the same rendering conditions it ought to remain visually identical
export interface GrapherInterface extends SortConfig {
    type?: ChartTypeName
    id?: number
    version?: number
    slug?: string
    title?: string
    subtitle?: string
    sourceDesc?: string
    note?: string
    hideTitleAnnotation?: boolean
    minTime?: TimeBound
    maxTime?: TimeBound
    timelineMinTime?: Time
    timelineMaxTime?: Time
    dimensions?: OwidChartDimensionInterface[]
    addCountryMode?: EntitySelectionMode
    comparisonLines?: ComparisonLineConfig[]
    stackMode?: StackMode

    showNoDataArea?: boolean
    hideLegend?: boolean
    logo?: LogoOption
    hideLogo?: boolean
    hideRelativeToggle?: boolean
    entityType?: string
    entityTypePlural?: string
    hideTimeline?: boolean
    zoomToSelection?: boolean
    showYearLabels?: boolean // Always show year in labels for bar charts
    hasChartTab?: boolean
    hasMapTab?: boolean
    tab?: GrapherTabOption
    overlay?: GrapherTabOption
    relatedQuestions?: RelatedQuestionsConfig[]
    details?: Record<string, Record<string, Detail>>
    internalNotes?: string
    variantName?: string
    originUrl?: string
    topicIds?: TopicId[]
    isPublished?: boolean
    baseColorScheme?: ColorSchemeName
    invertColorScheme?: boolean
    hideLinesOutsideTolerance?: boolean
    hideConnectedScatterLines?: boolean // Hides lines between points when timeline spans multiple years. Requested by core-econ for certain charts
    scatterPointLabelStrategy?: ScatterPointLabelStrategy
    treemapRenderStrategy?: TreemapRenderStrategy
    compareEndPointsOnly?: boolean
    matchingEntitiesOnly?: boolean
    hideTotalValueLabel?: boolean
    excludedEntities?: number[]
    includedEntities?: number[]
    selectedEntityNames?: EntityName[]
    selectedEntityColors?: { [entityName: string]: string | undefined }
    selectedEntityIds?: EntityId[]
    facet?: FacetStrategy

    xAxis?: Partial<AxisConfigInterface>
    yAxis?: Partial<AxisConfigInterface>
    colorScale?: Partial<ColorScaleConfigInterface>
    map?: Partial<MapConfigWithLegacyInterface>

    // When we move graphers to Git, and remove dimensions, we can clean this up.
    ySlugs?: ColumnSlugs
    xSlug?: ColumnSlug
    sizeSlug?: ColumnSlug
    colorSlug?: ColumnSlug
}

export interface LegacyGrapherInterface extends GrapherInterface {
    data: any
}

export interface GrapherQueryParams extends QueryParams {
    tab?: string
    overlay?: string
    stackMode?: string
    zoomToSelection?: string
    xScale?: string
    yScale?: string
    time?: string
    region?: string
    shown?: string
    endpointsOnly?: string
    selection?: string
    facet?: string
    uniformYAxis?: string
}

export interface LegacyGrapherQueryParams extends GrapherQueryParams {
    year?: string
    country?: string // deprecated
}

// Another approach we may want to try is this: https://github.com/mobxjs/serializr
export const grapherKeysToSerialize = [
    "type",
    "id",
    "version",
    "slug",
    "title",
    "subtitle",
    "sourceDesc",
    "note",
    "hideTitleAnnotation",
    "minTime",
    "maxTime",
    "timelineMinTime",
    "timelineMaxTime",
    "addCountryMode",
    "stackMode",
    "showNoDataArea",
    "hideLegend",
    "logo",
    "hideLogo",
    "hideRelativeToggle",
    "entityType",
    "entityTypePlural",
    "hideTimeline",
    "zoomToSelection",
    "showYearLabels",
    "hasChartTab",
    "hasMapTab",
    "tab",
    "internalNotes",
    "variantName",
    "originUrl",
    "isPublished",
    "baseColorScheme",
    "invertColorScheme",
    "hideLinesOutsideTolerance",
    "hideConnectedScatterLines",
    "scatterPointLabelStrategy",
    "treemapRenderStrategy",
    "compareEndPointsOnly",
    "matchingEntitiesOnly",
    "includedEntities",
    "hideTotalValueLabel",
    "xAxis",
    "yAxis",
    "colorScale",
    "map",
    "dimensions",
    "selectedEntityNames",
    "selectedEntityColors",
    "selectedEntityIds",
    "sortBy",
    "sortOrder",
    "sortColumnSlug",
    "excludedEntities",
    "selectedFacetStrategy",
    "hideFacetControl",
    "comparisonLines",
    "relatedQuestions",
    "topicIds",
    "details",
]
