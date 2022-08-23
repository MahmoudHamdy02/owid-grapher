import { ChartSeries } from "../chart/ChartInterface.js"
import { ChartManager } from "../chart/ChartManager.js"

export interface TreemapChartManager extends ChartManager {
    hasTimeline?: boolean
}

export interface TreemapSeries extends ChartSeries {
    label: string
}
