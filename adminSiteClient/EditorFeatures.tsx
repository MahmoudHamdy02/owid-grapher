import { EntitySelectionMode } from "../grapher/core/GrapherConstants.js"
import { computed } from "mobx"
import { ChartEditor } from "./ChartEditor.js"

// Responsible for determining what parts of the editor should be shown, based on the
// type of chart being edited
export class EditorFeatures {
    editor: ChartEditor
    constructor(editor: ChartEditor) {
        this.editor = editor
    }

    @computed get grapher() {
        return this.editor.grapher
    }

    @computed get canCustomizeYAxisScale() {
        return !this.grapher.isStackedArea && !this.grapher.isStackedBar
    }

    @computed get canCustomizeXAxisScale() {
        return this.grapher.isScatter || this.grapher.isMarimekko
    }

    @computed get canCustomizeYAxisLabel() {
        return this.grapher.isScatter || this.grapher.isMarimekko
    }

    @computed get canCustomizeXAxisLabel() {
        return true
    }

    @computed get canCustomizeYAxis() {
        return this.canCustomizeYAxisScale || this.canCustomizeYAxisLabel
    }

    @computed get canCustomizeXAxis() {
        return this.canCustomizeXAxisScale || this.canCustomizeXAxisLabel
    }

    @computed get canRemovePointsOutsideAxisDomain() {
        return this.grapher.isScatter
    }

    @computed get timeDomain() {
        return !(this.grapher.isDiscreteBar || this.grapher.isTreemap)
    }

    @computed get timelineRange() {
        return !(this.grapher.isDiscreteBar || this.grapher.isTreemap)
    }

    @computed get showYearLabels() {
        return this.grapher.isDiscreteBar
    }

    @computed get hideLegend() {
        return (
            this.grapher.isLineChart ||
            this.grapher.isStackedArea ||
            this.grapher.isStackedDiscreteBar
        )
    }

    @computed get stackedArea() {
        return this.grapher.isStackedArea
    }

    @computed get entityType() {
        return this.grapher.addCountryMode !== EntitySelectionMode.Disabled
    }

    @computed get relativeModeToggle() {
        return (
            this.grapher.isStackedArea ||
            this.grapher.isStackedDiscreteBar ||
            this.grapher.isLineChart ||
            this.grapher.isScatter ||
            this.grapher.isMarimekko
        )
    }

    @computed get comparisonLine() {
        return this.grapher.isLineChart || this.grapher.isScatter
    }

    @computed get canSpecifySortOrder() {
        return (
            this.grapher.isStackedDiscreteBar ||
            this.grapher.isLineChart ||
            this.grapher.isDiscreteBar ||
            this.grapher.isMarimekko
        )
    }

    @computed get canSortByColumn() {
        return this.grapher.isStackedDiscreteBar || this.grapher.isMarimekko
    }

    @computed get canHideTotalValueLabel() {
        return this.grapher.isStackedDiscreteBar
    }
}
