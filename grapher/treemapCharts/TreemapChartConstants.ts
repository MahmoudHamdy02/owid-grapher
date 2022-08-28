import { ChartSeries } from "../chart/ChartInterface.js"
import { ChartManager } from "../chart/ChartManager.js"
import { TreemapRenderStrategy } from "../core/GrapherConstants.js"

export interface TreemapChartManager extends ChartManager {
    hasTimeline?: boolean
    treemapRenderStrategy?: TreemapRenderStrategy
}

export interface TreemapSeries extends ChartSeries {
    label?: string
    value: number
}

export interface TreemapBlock {
    x: number
    y: number
    width: number
    height: number
    color: string
    text: string
}
