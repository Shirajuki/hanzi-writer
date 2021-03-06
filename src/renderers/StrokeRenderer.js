const Renderer = require('./Renderer');
const {counter, inherits } = require('../utils');
const svg = require('../svg');
const {
  extendPointOnLine,
  getLineSegmentsPortion,
  filterParallelPoints,
  linesToPolygon,
} = require('../geometry');

const STROKE_WIDTH = 200;

// take points on a path and move their start point backwards by distance
const extendStart = (points, distance) => {
  if (points.length < 2) return points;
  const p1 = points[1];
  const p2 = points[0];
  const newStart = extendPointOnLine(p1, p2, distance);
  const extendedPoints = points.slice(1);
  extendedPoints.unshift(newStart);
  return extendedPoints;
};

// take points on a path and move their end point backwards by distance
const extendEnd = (points, distance) => {
  if (points.length < 2) return points;
  const p1 = points[points.length - 2];
  const p2 = points[points.length - 1];
  const newEnd = extendPointOnLine(p1, p2, distance);
  const extendedPoints = points.slice(0, points.length - 1);
  extendedPoints.push(newEnd);
  return extendedPoints;
};

// this is a stroke composed of several stroke parts
function StrokeRenderer(stroke) {
  StrokeRenderer.super_.call(this);
  this._oldProps = {};
  this._stroke = stroke;
  this._maskPathLength = stroke.getLength() + (STROKE_WIDTH / 2);
}
inherits(StrokeRenderer, Renderer);

StrokeRenderer.prototype.mount = function(canvas, props) {
  const { usePolygonMasks } = props;
  this._path = svg.createElm('path');
  const maskType = usePolygonMasks ? 'clipPath' : 'mask';
  this._mask = svg.createElm(maskType);
  this._maskPath = svg.createElm('path');
  const maskId = `mask-${counter()}`;
  svg.attr(this._mask, 'id', maskId);

  svg.attr(this._path, 'd', this._stroke.path);
  this._path.style.opacity = 0;
  const maskAttr = usePolygonMasks ? 'clip-path' : 'mask';
  svg.attr(this._path, maskAttr, `url(#${maskId})`);

  this.extendedMaskPoints = extendStart(filterParallelPoints(this._stroke.points), STROKE_WIDTH / 2);
  if (usePolygonMasks) {
    this.extendedMaskPoints = extendEnd(this.extendedMaskPoints, STROKE_WIDTH / 2);
    this._polyMaskTip = svg.createElm('circle');
    // need to add this to the mask before the maskPath or else weird things happen. Not sure why
    this._mask.appendChild(this._polyMaskTip);
    svg.attr(this._polyMaskTip, 'r', STROKE_WIDTH / 2);
    this._setPolyMaskPortion(1);
  } else {
    svg.attr(this._maskPath, 'd', svg.getPathString(this.extendedMaskPoints));
    svg.attrs(this._maskPath, {
      stroke: '#FFFFFF',
      'stroke-width': STROKE_WIDTH,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'miter',
      'stroke-dasharray': `${this._maskPathLength},${this._maskPathLength}`,
    });
  }

  this._mask.appendChild(this._maskPath);
  canvas.defs.appendChild(this._mask);
  canvas.svg.appendChild(this._path);
  return this;
};

StrokeRenderer.prototype.render = function(props) {
  const { usePolygonMasks } = props;
  if (props.displayPortion !== this._oldProps.displayPortion) {
    if (usePolygonMasks) {
      this._setPolyMaskPortion(props.displayPortion);
    } else {
      this._maskPath.style.strokeDashoffset = this._getStrokeDashoffset(props.displayPortion);
    }
  }

  const color = this._getColor(props);
  if (color !== this._getColor(this._oldProps)) {
    svg.attrs(this._path, {
      fill: color,
      stroke: color,
    });
  }

  if (props.strokeWidth !== this._oldProps.strokeWidth) {
    svg.attrs(this._path, { strokeWidth: props.strokeWidth });
  }

  if (props.opacity !== this._oldProps.opacity) {
    this._path.style.opacity = props.opacity;
  }
  this._oldProps = props;
};

StrokeRenderer.prototype._setPolyMaskPortion = function(portion) {
  const strokePointsPortion = getLineSegmentsPortion(this.extendedMaskPoints, portion);
  const pathString = svg.getPathString(linesToPolygon(strokePointsPortion, STROKE_WIDTH), true);
  const endPoint = strokePointsPortion[strokePointsPortion.length - 1];
  svg.attr(this._maskPath, 'd', pathString);
  svg.attr(this._polyMaskTip, 'cx', endPoint.x);
  svg.attr(this._polyMaskTip, 'cy', endPoint.y);
};

StrokeRenderer.prototype._getStrokeDashoffset = function(displayPortion) {
  return this._maskPathLength * 0.999 * (1 - displayPortion);
};

StrokeRenderer.prototype._getColor = function({ strokeColor, radicalColor }) {
  return radicalColor && this._stroke.isInRadical ? radicalColor : strokeColor;
};

StrokeRenderer.prototype.destroy = function() {
  StrokeRenderer.super_.prototype.destroy.call(this);
  svg.removeElm(this._maskPath);
  svg.removeElm(this._polyMaskTip);
  svg.removeElm(this._path);
  svg.removeElm(this._mask);
};

module.exports = StrokeRenderer;
