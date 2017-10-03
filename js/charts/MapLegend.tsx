import * as React from 'react'
import { min, max, reduce, map, each, last, sortBy, flatten, some, find } from './Util'
import Bounds from './Bounds'
import { computed, action } from 'mobx'
import { observer } from 'mobx-react'
import { getRelativeMouse } from './Util'
import { MapLegendBin, NumericBin, CategoricalBin } from './MapData'
import TextWrap from './TextWrap'

interface NumericMapLegendProps {
    width: number,
    legendData: MapLegendBin[],
    focusBracket?: MapLegendBin
}

interface PositionedBin {
    x: number,
    width: number,
    margin: number,
    bin: MapLegendBin
}

interface NumericLabel {
    text: string,
    fontSize: string,
    bounds: Bounds,
    priority?: boolean,
    hidden: boolean,
}

class NumericMapLegend {
    props: NumericMapLegendProps
    constructor(props: NumericMapLegendProps) {
        this.props = props
    }

    @computed get focusBracket() { return this.props.focusBracket }
    @computed get numericBins(): NumericBin[] { return this.props.legendData.filter(l => l instanceof NumericBin) as NumericBin[] }
    @computed get rectHeight(): number { return 10 }
    @computed get tickFontSize(): number { return 0.75 }

    // NumericMapLegend wants to map a range to a width. However, sometimes we are given
    // data without a clear min/max. So we must fit these scurrilous bins into the width somehow.
    @computed get minValue(): number { return min(this.numericBins.map(d => d.min)) as number }
    @computed get maxValue(): number { return max(this.numericBins.map(d => d.max)) as number }
    @computed get rangeSize(): number { return this.maxValue - this.minValue }
    @computed get categoryBinWidth(): number {
        return Bounds.forText("No data", { fontSize: this.tickFontSize + 'em' }).width
    }
    @computed get categoryBinMargin(): number { return this.rectHeight * 1.5 }
    @computed get totalDefaultWidth(): number {
        return reduce(
            this.props.legendData.map(d => d instanceof CategoricalBin ? this.categoryBinWidth + this.categoryBinMargin : 0),
            (m, n) => m + n, 0
        )
    }
    @computed get availableWidth(): number {
        return this.props.width - this.totalDefaultWidth
    }

    @computed get positionedBins(): PositionedBin[] {
        const { props, rangeSize, categoryBinWidth, categoryBinMargin, availableWidth } = this
        let xOffset = 0

        return map(props.legendData, d => {
            let width = categoryBinWidth, margin = categoryBinMargin
            if (d instanceof NumericBin) {
                width = ((d.max - d.min) / rangeSize) * availableWidth
                margin = 0
            }

            const x = xOffset
            xOffset += width + margin

            return {
                x: x,
                width: width,
                margin: margin,
                bin: d
            }
        })
    }

    @computed get numericLabels(): NumericLabel[] {
        const { rectHeight, positionedBins } = this
        const fontSize = this.tickFontSize + 'em'

        const makeBoundaryLabel = (d: PositionedBin, minOrMax: 'min' | 'max', text: string) => {
            const labelBounds = Bounds.forText(text, { fontSize: fontSize })
            const x = d.x + (minOrMax === 'min' ? 0 : d.width) - labelBounds.width / 2
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                hidden: false
            }
        }

        const makeRangeLabel = (d: PositionedBin) => {
            const labelBounds = Bounds.forText(d.bin.text, { fontSize: fontSize })
            const x = d.x + d.width / 2 - labelBounds.width / 2
            const y = -rectHeight - labelBounds.height - 3

            return {
                text: d.bin.text,
                fontSize: fontSize,
                bounds: labelBounds.extend({ x: x, y: y }),
                priority: true,
                hidden: false
            }
        }

        let labels: NumericLabel[] = []
        each(positionedBins, d => {
            if (d.bin.text)
                labels.push(makeRangeLabel(d))
            else if (d.bin instanceof NumericBin) {
                labels.push(makeBoundaryLabel(d, 'min', d.bin.minText))
                if (d === last(positionedBins))
                    labels.push(makeBoundaryLabel(d, 'max', d.bin.maxText))
            }
        })

        for (let i = 0; i < labels.length; i++) {
            const l1 = labels[i]
            if (l1.hidden) continue

            for (let j = i + 1; j < labels.length; j++) {
                const l2 = labels[j]
                if (l1.bounds.right + 5 >= l2.bounds.centerX || l2.bounds.left - 5 <= l1.bounds.centerX && !l2.priority)
                    l2.hidden = true
            }
        }

        labels = labels.filter(l => !l.hidden)

        // If labels overlap, first we try alternating raised labels
        let raisedMode = false
        for (let i = 1; i < labels.length; i++) {
            const l1 = labels[i - 1], l2 = labels[i]
            if (l1.bounds.right + 5 >= l2.bounds.left) {
                raisedMode = true
                break
            }
        }

        if (raisedMode) {
            for (let i = 1; i < labels.length; i++) {
                const l = labels[i]
                if (i % 2 !== 0) {
                    l.bounds = l.bounds.extend({ y: l.bounds.y - l.bounds.height - 1 })
                }
            }
        }

        return labels
    }

    @computed get height(): number { return Math.abs(min(this.numericLabels.map(l => l.bounds.y)) as number) }

    @computed get width(): number {
        return this.props.width
    }
}

@observer
class NumericMapLegendView extends React.Component<{ legend: NumericMapLegend, x: number, y: number, onMouseOver: (d: MapLegendBin) => void, onMouseLeave: () => void }> {
    base: SVGGElement

    @computed get bounds(): Bounds {
        const { props } = this
        return new Bounds(props.x, props.y, props.legend.width, props.legend.height)
    }

    @computed get legend(): NumericMapLegend {
        return this.props.legend
    }

    @action.bound onMouseMove(ev: MouseEvent) {
        const { legend, props, base } = this
        const { focusBracket } = legend
        const mouse = getRelativeMouse(base, ev)
        if (!this.bounds.contains(mouse))
            if (focusBracket)
                return this.props.onMouseLeave()
            else
                return

        let newFocusBracket = null
        legend.positionedBins.forEach(d => {
            if (mouse.x >= props.x + d.x && mouse.x <= props.x + d.x + d.width)
                newFocusBracket = d.bin
        })

        if (newFocusBracket)
            this.props.onMouseOver(newFocusBracket)
    }

    componentDidMount() {
        document.documentElement.addEventListener('mousemove', this.onMouseMove)
        document.documentElement.addEventListener('touchmove', this.onMouseMove)
    }

    componentWillUnmount() {
        document.documentElement.removeEventListener('mousemove', this.onMouseMove)
        document.documentElement.removeEventListener('touchmove', this.onMouseMove)
    }

    render() {
        const { props, legend } = this
        const { rectHeight, numericLabels, height, positionedBins, focusBracket } = legend
        //Bounds.debug([this.bounds])

        const borderColor = "#333"
        const bottomY = props.y + height

        return <g className="numericMapLegend">
            {map(numericLabels, label =>
                <line x1={props.x + label.bounds.x + label.bounds.width / 2} y1={bottomY - rectHeight} x2={props.x + label.bounds.x + label.bounds.width / 2} y2={bottomY + label.bounds.y + label.bounds.height} stroke={borderColor} strokeWidth={0.3} />
            )}
            {sortBy(map(positionedBins, d => {
                const isFocus = focusBracket && ((d.bin as NumericBin).min === (focusBracket as NumericBin).min || ((d.bin as CategoricalBin).value != null && (d.bin as CategoricalBin).value === (focusBracket as CategoricalBin).value))
                return <rect x={props.x + d.x} y={bottomY - rectHeight} width={d.width} height={rectHeight} fill={d.bin.color} stroke={isFocus ? "#FFEC38" : borderColor} strokeWidth={isFocus ? 2.5 : 0.3} />
            }), r => r.props['stroke-width'])}
            {map(numericLabels, label =>
                <text x={props.x + label.bounds.x} y={bottomY + label.bounds.y} fontSize={label.fontSize} dominant-baseline="hanging">{label.text}</text>
            )}
        </g>
    }
}

interface CategoricalMapLegendProps {
    maxWidth: number,
    scale: number,
    legendData: CategoricalBin[],
    focusBracket?: CategoricalBin
}

interface CategoricalMark {
    x: number,
    y: number,
    rectSize: number,
    label: {
        text: string,
        bounds: Bounds,
        fontSize: string
    },
    bin: CategoricalBin
}

interface MarkLine {
    totalWidth: number,
    marks: CategoricalMark[]
}

class CategoricalMapLegend {
    props: CategoricalMapLegendProps
    constructor(props: CategoricalMapLegendProps) {
        this.props = props
    }

    @computed get markLines(): MarkLine[] {
        const props = this.props, rectSize = 10 * props.scale,
            rectPadding = 5, markPadding = 5, fontSize = (0.6 * props.scale) + "em"

        const lines: MarkLine[] = []
        let marks: CategoricalMark[] = [], xOffset = 0, yOffset = 0
        each(props.legendData, d => {
            const labelBounds = Bounds.forText(d.text, { fontSize: fontSize })
            const markWidth = rectSize + rectPadding + labelBounds.width + markPadding

            if (xOffset + markWidth > props.maxWidth) {
                lines.push({ totalWidth: xOffset - markPadding, marks: marks })
                marks = []
                xOffset = 0
                yOffset += rectSize + rectPadding
            }

            const markX = xOffset, markY = yOffset

            const label = {
                text: d.text,
                bounds: labelBounds.extend({ x: markX + rectSize + rectPadding, y: markY + 1.5 }),
                fontSize: fontSize
            }

            marks.push({
                x: markX,
                y: markY,
                rectSize: rectSize,
                label: label,
                bin: d
            })

            xOffset += markWidth
        })

        if (marks.length > 0) {
            lines.push({ totalWidth: xOffset - markPadding, marks: marks })
        }

        return lines
    }

    @computed get width(): number {
        return max(this.markLines.map(l => l.totalWidth)) as number
    }

    @computed get marks(): CategoricalMark[] {
        const lines = this.markLines

        // Center each line
        each(lines, line => {
            const xShift = this.width / 2 - line.totalWidth / 2
            each(line.marks, m => {
                m.x += xShift
                m.label.bounds = m.label.bounds.extend({ x: m.label.bounds.x + xShift })
            })
        })

        return flatten(map(lines, l => l.marks))
    }

    @computed get height(): number {
        return max(this.marks.map(m => m.y + m.rectSize)) as number
    }
}

interface CategoricalMapLegendViewProps {
    legend: CategoricalMapLegend,
    x: number,
    y: number,
    onMouseOver: (d: CategoricalBin) => void,
    onMouseLeave: () => void
}

@observer
class CategoricalMapLegendView extends React.Component<CategoricalMapLegendViewProps> {
    render() {
        const { props } = this
        const { marks } = props.legend
        const { focusBracket } = props.legend.props

        //Bounds.debug([this.bounds])
        //Bounds.debug(marks.map(m => m.label.bounds))
        return <g className="categoricalMapLegend">
            {map(marks, m => {
                const isFocus = focusBracket && m.bin.value === focusBracket.value
                const stroke = isFocus ? "#FFEC38" : "#333"
                return <g onMouseOver={() => this.props.onMouseOver(m.bin)} onMouseLeave={() => this.props.onMouseLeave()}>
                    <rect x={(props.x as number) + m.x} y={(props.y as number) + m.y} width={m.rectSize} height={m.rectSize} fill={m.bin.color} stroke={stroke} stroke-width={0.4} />,
                  <text x={(props.x as number) + m.label.bounds.x} y={(props.y as number) + m.label.bounds.y} fontSize={m.label.fontSize} dominant-baseline="hanging">{m.label.text}</text>
                </g>
            })}
        </g>
    }
}

export interface MapLegendProps {
    legendData: MapLegendBin[],
    title: string,
    bounds: Bounds,
    focusBracket: MapLegendBin,
    focusEntity: any
}

export default class MapLegend {
    props: MapLegendProps
    constructor(props: MapLegendProps) {
        this.props = props
    }

    @computed get numericLegendData(): MapLegendBin[] {
        if (this.hasCategorical || !some(this.props.legendData, d => (d as CategoricalBin).value === "No data" && !d.isHidden)) {
            return this.props.legendData.filter(l => l instanceof NumericBin && !l.isHidden)
        } else {
            const bin = this.props.legendData.filter(l => (l instanceof NumericBin || l.value === "No data") && !l.isHidden)
            return flatten([bin[bin.length - 1], bin.slice(0, -1)])
        }
    }
    @computed get hasNumeric(): boolean { return this.numericLegendData.length > 1 }
    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.props.legendData.filter(l => l instanceof CategoricalBin && !l.isHidden) as CategoricalBin[]
    }
    @computed get hasCategorical(): boolean { return this.categoricalLegendData.length > 1 }

    @computed get mainLabel(): TextWrap {
        return new TextWrap({ maxWidth: this.props.bounds.width, fontSize: 0.7, text: this.props.title })
    }

    @computed get numericFocusBracket(): MapLegendBin | undefined {
        const { focusBracket, focusEntity } = this.props
        const { numericLegendData } = this
        if (focusBracket)
            return focusBracket
        else if (focusEntity)
            return find(numericLegendData, bin => {
                if (bin instanceof CategoricalBin)
                    return focusEntity.datum.value === bin.value
                else if (bin instanceof NumericBin)
                    return focusEntity.datum.value >= bin.min && focusEntity.datum.value <= bin.max
                else
                    return false
            })
        else
            return undefined
    }

    @computed get categoricalFocusBracket(): CategoricalBin | undefined {
        const { focusBracket, focusEntity } = this.props
        const { categoricalLegendData } = this
        if (focusBracket && focusBracket instanceof CategoricalBin)
            return focusBracket
        else if (focusEntity)
            return find(categoricalLegendData, bin => focusEntity.datum.value === bin.value)
        else
            return undefined
    }

    @computed get categoryLegend(): CategoricalMapLegend | undefined {
        const that = this
        return this.hasCategorical ? new CategoricalMapLegend({
            get legendData() { return that.categoricalLegendData },
            get maxWidth() { return that.props.bounds.width * 0.8 },
            get scale() { return 1 }
        }) : undefined
    }

    @computed get categoryLegendHeight(): number {
        return this.categoryLegend ? this.categoryLegend.height + 5 : 0
    }

    @computed get numericLegend(): NumericMapLegend | undefined {
        const that = this
        return this.hasNumeric ? new NumericMapLegend({
            get legendData() { return that.numericLegendData },
            get width() { return that.props.bounds.width * 0.5 },
            get focusBracket() { return that.numericFocusBracket }
        }) : undefined
    }

    @computed get numericLegendHeight(): number {
        return this.numericLegend ? this.numericLegend.height : 0
    }

    @computed get height(): number {
        return this.mainLabel.height + this.categoryLegendHeight + this.numericLegendHeight + 10
    }

    @computed get bounds() {
        return this.props.bounds
    }
}

export interface MapLegendViewProps {
    legend: MapLegend,
    onMouseOver: (d: MapLegendBin) => void,
    onMouseLeave: () => void
}

@observer
export class MapLegendView extends React.Component<MapLegendViewProps> {
    render() {
        const { legend, onMouseOver, onMouseLeave } = this.props
        const { bounds, mainLabel, numericLegend, categoryLegend, categoryLegendHeight } = legend

        return <g className="mapLegend">
            {numericLegend && <NumericMapLegendView legend={numericLegend} x={bounds.centerX - numericLegend.width / 2} y={bounds.bottom - mainLabel.height - categoryLegendHeight - numericLegend.height - 4} onMouseOver={onMouseOver} onMouseLeave={onMouseLeave} />}
            {categoryLegend && <CategoricalMapLegendView legend={categoryLegend} x={bounds.centerX - categoryLegend.width / 2} y={bounds.bottom - mainLabel.height - categoryLegendHeight} onMouseOver={onMouseOver} onMouseLeave={onMouseLeave} />}
            />}
            {mainLabel.render(bounds.centerX - mainLabel.width / 2, bounds.bottom - mainLabel.height)}
        </g>
    }
}
