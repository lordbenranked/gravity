import define1 from "./ab07a49dc1b41864@288.js";
import define2 from "./b1c1bcfaa4edd969@153.js";

function _1(md){return(
md`# Observable Plot + regl`
)}

function _2(md){return(
md`This notebook tests out a simple helper which creates a stack of elements so that you can, for example, layer axes over or under a [regl](https://github.com/regl-project/regl) WebGL context. It exposes two helpers:

1. \`elementStack\`: a helper to position and organize a stack of graphics contexts of your choosing.
2. \`createAxisConfiguration\`: a \`regl\` command which receives an Observable Plot instance and configures the corresponding \`view\` and \`viewInverse\` matrices for use in vertex and fragment shaders.

This approach is not my first preference as it results in an awkward mix of SVG and WebGL elements. The last time I investigated trying to properly nest a WebGL context within an SVG hierarchy as a [\`foreignObject\`](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject), I discovered that the Blink rendering engine code inside Chrome(ium) is old and extremely complicated (so-called "crispy noodle code") and fails to correctly embed a WebGL context within the SVG hierarchy. As a result of the element stacking compromise, Observable's "Download PNG/SVG" commands will not work as expected. If you want to export the result, you will need to take a screenshot.

You can see a successful use of that in the example below or in the [Line Integral Convolution](https://observablehq.com/@rreusser/line-integral-convolution) notebook. Can you perhaps do better? Let me know!`
)}

function _layers(elementStack,width,reglCanvas,Plot){return(
elementStack(this, {
  width: Math.min(width, 400),
  height: Math.min(width, 400),
  layers: {
    regl: ({ current, width, height }) =>
      reglCanvas(current, { width, height }),
    plot: ({ width, height }) =>
      Plot.plot({
        width,
        style: { backgroundColor: "transparent", maxWidth: "none" },
        aspectRatio: 1,
        x: { grid: true, domain: [-1, 1] },
        y: { grid: true, domain: [-1, 1] },
        marks: [
          Plot.frame(),
          Plot.ruleY([0]),
          Plot.ruleX([0]),
          Plot.line(
            [
              [-0.5, -0.5],
              [0.5, -0.5],
              [0, 0.5],
              [-0.5, -0.5]
            ],
            { strokeWidth: 4 }
          )
        ]
      })
  }
})
)}

function _regl(layers){return(
layers.regl.value
)}

function _configureAxes(createAxisConfiguration,regl){return(
createAxisConfiguration(regl)
)}

function _7(layers,regl,configureAxes,drawTriangle)
{
  const xaxis = layers.plot.scale("x");
  const yaxis = layers.plot.scale("y");

  regl.poll();
  configureAxes(xaxis, yaxis, () => {
    drawTriangle();
  });
}


function _drawTriangle(regl){return(
regl({
  vert: `
    precision highp float;
    attribute vec2 xy;
    attribute vec3 color;
    uniform mat4 view;
    varying vec3 vColor;
    void main () {
      vColor = color;
      gl_Position = view * vec4(xy, 0, 1);
    }`,
  frag: `
    precision lowp float;
    varying vec3 vColor;
    void main () {
      gl_FragColor = vec4(pow(vColor, vec3(1.0 / 2.2)), 1);
    }`,
  attributes: {
    xy: [-0.5, -0.5, 0.5, -0.5, 0, 0.5],
    color: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]
  },
  primitive: "triangles",
  count: 3,
  depth: { enable: false }
})
)}

function _9(md){return(
md`## Implementation`
)}

function _10(md){return(
md`### Element stack`
)}

function _elementStack(ResizeObserver){return(
function elementStack(
  currentStack,
  { width = null, height = null, layers = {}, onResize = null } = {}
) {
  const container = currentStack || document.createElement("figure");
  container.style.position = "relative";
  if (!currentStack && onResize) {
    const observer = new ResizeObserver(([{ contentRect }]) => {
      onResize({ layers: container.value, rect: contentRect });
      container.dispatchEvent(new CustomEvent("input"));
    });
    observer.observe(container);
  }
  const stack = {};
  let defaultZindex = 0;
  for (const [label, props] of Object.entries(layers)) {
    const layer = typeof props === "function" ? props : props.layer;
    const id = `element-stack-layer-${label}`;
    const current = container.querySelector(`#${id}`);
    const newEl = layer({ current, width, height });
    newEl.setAttribute("id", id);
    if (!newEl.style.position) newEl.style.position = "absolute";
    stack[label] = newEl;
    if (current) {
      current.replaceWith(newEl);
    } else {
      container.appendChild(newEl);
    }
  }
  if (width) container.style.width = `${width}px`;
  if (height) container.style.height = `${height}px`;
  container.value = stack;
  return container;
}
)}

function _12(md){return(
md`### Regl axis helper`
)}

function _createAxisConfiguration(mat4create,mat4ortho,mat4invert){return(
function createAxisConfiguration(regl) {
  const configureAxes = regl({
    uniforms: {
      view: regl.prop("view"),
      viewInverse: regl.prop("viewInverse")
    },
    context: {
      view: regl.prop("view"),
      viewInverse: regl.prop("viewInverse")
    },
    scissor: {
      enable: true,
      box: {
        x: ({ pixelRatio }, { xRange: [xmin, xmax] }) => xmin * pixelRatio,
        y: ({ pixelRatio, framebufferHeight }, { yRange: [ymax, ymin] }) =>
          framebufferHeight - ymax * pixelRatio,
        width: ({ pixelRatio }, { xRange: [xmin, xmax] }) =>
          (xmax - xmin) * pixelRatio,
        height: ({ pixelRatio }, { yRange: [ymax, ymin] }) =>
          (ymax - ymin) * pixelRatio
      }
    },
    viewport: {
      x: ({ pixelRatio }, { xRange: [xmin, xmax] }) => xmin * pixelRatio,
      y: ({ pixelRatio, framebufferHeight }, { yRange: [ymax, ymin] }) =>
        framebufferHeight - ymax * pixelRatio,
      width: ({ pixelRatio }, { xRange: [xmin, xmax] }) =>
        (xmax - xmin) * pixelRatio,
      height: ({ pixelRatio }, { yRange: [ymax, ymin] }) =>
        (ymax - ymin) * pixelRatio
    }
  });

  const view = mat4create();
  const viewInverse = mat4create();

  return function (xScale, yScale, callback) {
    mat4ortho(view, ...xScale.domain, ...yScale.domain, -1, 1);
    mat4invert(viewInverse, view);
    configureAxes(
      { view, viewInverse, xRange: xScale.range, yRange: yScale.range },
      callback
    );
  };
}
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["md"], _1);
  main.variable(observer()).define(["md"], _2);
  const child1 = runtime.module(define1);
  main.import("reglCanvas", child1);
  main.variable(observer("viewof layers")).define("viewof layers", ["elementStack","width","reglCanvas","Plot"], _layers);
  main.variable(observer("layers")).define("layers", ["Generators", "viewof layers"], (G, _) => G.input(_));
  main.variable(observer("regl")).define("regl", ["layers"], _regl);
  main.variable(observer("configureAxes")).define("configureAxes", ["createAxisConfiguration","regl"], _configureAxes);
  main.variable(observer()).define(["layers","regl","configureAxes","drawTriangle"], _7);
  main.variable(observer("drawTriangle")).define("drawTriangle", ["regl"], _drawTriangle);
  main.variable(observer()).define(["md"], _9);
  main.variable(observer()).define(["md"], _10);
  main.variable(observer("elementStack")).define("elementStack", ["ResizeObserver"], _elementStack);
  main.variable(observer()).define(["md"], _12);
  const child2 = runtime.module(define2);
  main.import("mat4create", child2);
  main.import("mat4ortho", child2);
  main.import("mat4invert", child2);
  main.variable(observer("createAxisConfiguration")).define("createAxisConfiguration", ["mat4create","mat4ortho","mat4invert"], _createAxisConfiguration);
  return main;
}
