import define1 from "./ecbb0a3f5eb5d4c8@3064.js";
import define2 from "./ab07a49dc1b41864@288.js";
import define3 from "./8a61f21e9b7da190@730.js";

function _1(tex,md){return(
md`# Magnetic Pendulum

The plot below represents a top-down view of a [magnetic pendulum](https://simple.wikipedia.org/wiki/Magnetic_pendulum). The dots arranged in an equilateral triangle represent three attracting magnets. Click and drag to move them. Each point on the plot represents the starting position of a pendulum. A pendulum is released from rest, and a bit of friction ensures it eventually comes to rest at one of the three magnets. Color indicates which of the three.

For two-dimensional position ${tex`\mathbf{x}`}, friction ${tex`b`}, and magnets ${tex`\mathbf{X}_n`}, the pendulum moves according to the equations

${tex.block`
\frac{d^2 \mathbf{x}}{dt^2} + b \frac{d\mathbf{x}}{dt} + \mathbf{x} = \sum_{n=1}^{3} \frac{\mathbf{X}_n - x}{\left(|\mathbf{X}_n - \mathbf{x}|^2 + h^2\right)^{5/2}}.
`}

Pendulum height ${tex`h`} means the bottom of the pendulum is elevated slightly above the magnets so that it doesn't experience infinite acceleration when it gets close.

The biggest challenge is computing this in a performant manner since the pendulum may change direction quickly and so needs a small time step, but at the same time some configurations may move for a long time before eventually coming to a rest. To solve this, I've adapted my adaptive [ODE45](https://observablehq.com/@rreusser/integration#ode45) implementation into GLSL. It's still a bit sluggish to compute, but all things considered not too bad!

For more information, see [The Magnetic Pendulum](https://chalkdustmagazine.com/features/the-magnetic-pendulum/) or [Gravity Fractals](https://www.youtube.com/watch?v=LavXSS5Xtbg&ab_channel=2swap).`
)}

function _stack(elementStack,width,reglCanvas,Plot,d3){return(
elementStack(this, {
  width: width, //Math.min(width, 512),
  height: width, //Math.floor(width * 0.7),
  layers: {
    regl: ({ current, width, height }) =>
      reglCanvas(current, {
        width,
        height,
        attributes: { depthStencil: false }
      }),
    plot: ({ width, height }) =>
      Plot.plot({
        width,
        aspectRatio: 1,
        style: { backgroundColor: "transparent", maxWidth: "none" },
        x: { domain: [-3, 3], grid: true, tickSpacing: 100 },
        y: {
          domain: [(-2.9 * height) / width, (2.9 * height) / width],
          grid: true,
          tickSpacing: 100
        }
      }),
    svg: ({ width, height }) =>
      d3.create("svg").attr("width", width).attr("height", height).node()
  }
})
)}

function _h(Inputs){return(
Inputs.range([1e-3 * 0, 1], {
  //transform: Math.log,
  label: "pendulum height, h",
  value: 0.5
})
)}

function _b(Inputs){return(
Inputs.range([1e-8, 1], { label: "friction", value: 0.15 })
)}

function _tolerance(Inputs){return(
Inputs.range([1e-6, 1e-2], {
  transform: Math.log,
  label: "tolerance",
  value: 3e-4
})
)}

function _steps(Inputs){return(
Inputs.range([0, 200], {
  label: "integration steps",
  value: 120,
  step: 1
})
)}

function _opts(Inputs){return(
Inputs.checkbox(["Draw trajectory"], {
  value: []
})
)}

function _magnets(){return(
[
  { index: 0, x: -Math.sqrt(3) * 0.5, y: -0.5 },
  { index: 1, x: Math.sqrt(3) * 0.5, y: -0.5 },
  { index: 2, x: 0, y: 1 }
]
)}

function _regl(stack){return(
stack.regl.value
)}

function _dirty(){return(
true
)}

function _renderLoop($0,regl,configureAxes,stack,drawField,h,b,$1,tolerance,invalidation)
{
  $0.value = true;
  let loop = regl.frame(({ time }) => {
    if (!$0.value) return;
    try {
      configureAxes(stack.plot.scale("x"), stack.plot.scale("y"), () => {
        regl.clear({ color: [1, 0, 0, 1] });
        drawField({ h, b, magnets: $1.value, tolerance });
      });
      $0.value = false;
    } catch (e) {
      console.error(e);
      if (loop) loop.cancel();
      loop = null;
    }
  });
  invalidation.then(() => {
    if (loop) loop.cancel();
    loop = null;
  });
}


function _drawField(regl,steps){return(
regl({
  vert: `
    precision highp float;
    attribute vec2 uv;
    varying vec2 xy;
    uniform mat4 viewInverse;
    void main () {
      xy = (viewInverse * vec4(uv, 0, 1)).xy;
      gl_Position = vec4(uv, 0, 1);
    }`,
  frag: `
    precision highp float;
    varying vec2 xy;
    uniform float epsilon2, b, tol2;
    uniform vec2 p0, p1, p2;
    
    vec4 deriv (vec4 y) {
      vec2 pos = y.xy;
      vec2 vel = y.zw;
      vec2 r0 = p0 - pos;
      vec2 r1 = p1 - pos;
      vec2 r2 = p2 - pos;
      float d0 = dot(r0, r0) + epsilon2;
      float d1 = dot(r1, r1) + epsilon2;
      float d2 = dot(r2, r2) + epsilon2;
      vec2 force = r0 / (d0 * d0 * sqrt(d0)) + 
                   r1 / (d1 * d1 * sqrt(d1)) +
                   r2 / (d2 * d2 * sqrt(d2));
      // Derivative of first two components (pos) is vel
      // Derivative of second two components (vel) is accel,
      // which comes from putting everything on RHS of the ODE
      return vec4(vel, force - b * vel - pos);
    }

    const float safety = 0.95;
    const float maxDecrease = 0.02;
    const float maxIncrease = 50.0;

    vec4 rk45 (vec4 y, inout float dt) { 
      // Fifth order estimate using constants for the Cash-Karp method
      vec4 k1 = deriv(y);
      vec4 k2 = deriv(y + dt * 0.2 * k1);
      vec4 k3 = deriv(y + dt * (0.075 * k1 + 0.225 * k2));
      vec4 k4 = deriv(y + dt * (0.3 * k1 - 0.9 * k2 + 1.2 * k3));
      vec4 k5 = deriv(y + dt * (-0.203703703703703703 * k1 + 2.5 * k2 - 2.592592592592592592 * k3 + 1.296296296296296296 * k4));
      vec4 k6 = deriv(y + dt * (0.029495804398148148 * k1 + 0.341796875 * k2 + 0.041594328703703703 * k3 + 0.400345413773148148 * k4 + 0.061767578125 * k5));

      // Estimate the error using the embedded fourth order method
      vec4 tmp = dt * (0.004293774801587301 * k1 - 0.018668586093857832 * k3 + 0.034155026830808080 * k4 + 0.019321986607142857 * k5 - 0.039102202145680406 * k6);
      float err2 = dot(tmp, tmp);

      // Wasteful, but only accept the step if error is within tolerance
      bool accept = err2 <= tol2;
      if (accept) y += dt * (0.097883597883597883 * k1 + 0.402576489533011272 * k3 + 0.210437710437710437 * k4 + 0.289102202145680406 * k6);

      // Either way, adjust dt according to the estimate
      dt *= clamp(safety * pow(tol2 / err2, accept ? 0.125 : 0.1), maxDecrease, maxIncrease);

      return y;
    }

    const float GAMMA = 2.2;
    const vec3 col0 = pow(vec3(0.9, 0.2, 0.6), vec3(GAMMA));
    const vec3 col1 = pow(vec3(0.6, 0.9, 0.2), vec3(GAMMA));
    const vec3 col2 = pow(vec3(0.2, 0.6, 0.9), vec3(GAMMA));

    vec3 computeWeightedColor (vec2 y) {
      vec2 r0 = y - p0;
      vec2 r1 = y - p1;
      vec2 r2 = y - p2;
      float w0 = 1.0 / dot(r0, r0);
      float w1 = 1.0 / dot(r1, r1);
      float w2 = 1.0 / dot(r2, r2);

      // Alternatively, don't weight and return the nearest
      // return w0 > w1 ? (w2 > w0 ? col2 : col0) : (w2 > w1 ? col2 : col1);

      return (w0 * col0 + w1 * col1 + w2 * col2) / (w0 + w1 + w2);
    }

    void main () {
      vec4 y = vec4(xy, vec2(0));
      float dtCurrent = 0.01;
      for (int i = 0; i < ${steps}; i++) y = rk45(y, dtCurrent);
      gl_FragColor = vec4(pow(computeWeightedColor(y.xy), vec3(1.0 / GAMMA)), 1);
    }`,
  attributes: {
    uv: [-4, -4, 4, -4, 0, 4]
  },
  uniforms: {
    epsilon2: (_, { h }) => h * h,
    b: regl.prop("b"),
    tol2: (_, { tolerance }) => tolerance * tolerance,
    p0: (_, { magnets }) => [magnets[0].x, magnets[0].y],
    p1: (_, { magnets }) => [magnets[1].x, magnets[1].y],
    p2: (_, { magnets }) => [magnets[2].x, magnets[2].y]
  },
  count: 3,
  depth: { enable: false }
})
)}

function _computeTrajectory(magnets,h,b,opts,ode45)
{
  function deriv(yp, [x, y, u, v]) {
    const r0x = magnets[0].x - x;
    const r0y = magnets[0].y - y;
    const r1x = magnets[1].x - x;
    const r1y = magnets[1].y - y;
    const r2x = magnets[2].x - x;
    const r2y = magnets[2].y - y;
    const d0 = r0x * r0x + r0y * r0y + h * h;
    const d1 = r1x * r1x + r1y * r1y + h * h;
    const d2 = r2x * r2x + r2y * r2y + h * h;
    const den0 = 1.0 / (d0 * d0 * Math.sqrt(d0));
    const den1 = 1.0 / (d1 * d1 * Math.sqrt(d1));
    const den2 = 1.0 / (d2 * d2 * Math.sqrt(d2));
    const fx = r0x * den0 + r1x * den1 + r2x * den2;
    const fy = r0y * den0 + r1y * den1 + r2y * den2;
    yp[0] = u;
    yp[1] = v;
    yp[2] = fx - b * u - x;
    yp[3] = fy - b * v - y;
  }
  return function computeTrajectory([x, y]) {
    if (!~opts.indexOf("Draw trajectory") || isNaN(x)) return [];
    const state = { y: [x, y, 0, 0], t: 0 };
    const history = [{ x: state.y[0], y: state.y[1] }];
    for (let i = 0; i < 2000 && !state.limitReached; i++) {
      ode45(state, deriv, { tLimit: 50, tolerance: 2e-6 });
      history.push({ x: state.y[0], y: state.y[1] });
    }
    return history;
  };
}


function _trajectoryStart(){return(
null
)}

function _trajectory(computeTrajectory,trajectoryStart){return(
computeTrajectory(trajectoryStart || [NaN, NaN])
)}

function _drawSVGLayer(stack,d3,$0,trajectory,magnets,$1,$2)
{
  const xScale = stack.plot.scale("x");
  const yScale = stack.plot.scale("y");
  const svg = d3.select(stack.svg).style("cursor", "crosshair");
  d3.selectAll("circle").remove();
  svg.on("mousemove", (event) => {
    $0.value = [
      xScale.invert(event.offsetX),
      yScale.invert(event.offsetY)
    ];
  });
  //window.addEventListener("mouseout", () => (mutable trajectoryStart = null));

  const makeline = d3
    .line()
    .x(({ x }) => xScale.apply(x))
    .y(({ y }) => yScale.apply(y));
  const line = svg
    .selectAll(".trajectory")
    .data([trajectory || []])
    .join(
      (enter) =>
        enter
          .append("path")
          .style("fill", "none")
          .style("stroke-width", 1)
          .style("stroke", "black")
          .attr("class", "trajectory")
          .attr("d", makeline),
      (update) => update.attr("d", makeline)
    );

  function updatePositions(p) {
    p.attr("r", 5)
      .attr("cx", ({ x }) => xScale.apply(x))
      .attr("cy", ({ y }) => yScale.apply(y));
  }
  svg
    .selectAll("circle")
    .data(magnets)
    .join(
      (enter) =>
        enter
          .append("circle")
          .style("fill", "black")
          .style("stroke", "white")
          .style("stroke-width", 2)
          .style("cursor", "move")
          .call(updatePositions)
          .call(
            d3.drag().on("drag", (event) => {
              let {
                sourceEvent: { offsetX, offsetY, touches },
                subject: { index }
              } = event;
              if (touches?.length) {
                const { x, y } = svg.node().getBoundingClientRect();
                offsetX = touches[0].clientX - x;
                offsetY = touches[0].clientY - y;
              }
              magnets[index].x = xScale.invert(offsetX);
              magnets[index].y = yScale.invert(offsetY);
              $1.value = $1.value;
              svg.selectAll("circle").call(updatePositions);
              $2.value = true;
            })
          ),
      (update) => update.call(updatePositions)
    );
  return svg.node();
}


function _configureAxes(createAxisConfiguration,regl){return(
createAxisConfiguration(regl)
)}

export default function define(runtime, observer) {
  const main = runtime.module();
  main.variable(observer()).define(["tex","md"], _1);
  main.variable(observer("viewof stack")).define("viewof stack", ["elementStack","width","reglCanvas","Plot","d3"], _stack);
  main.variable(observer("stack")).define("stack", ["Generators", "viewof stack"], (G, _) => G.input(_));
  main.variable(observer("viewof h")).define("viewof h", ["Inputs"], _h);
  main.variable(observer("h")).define("h", ["Generators", "viewof h"], (G, _) => G.input(_));
  main.variable(observer("viewof b")).define("viewof b", ["Inputs"], _b);
  main.variable(observer("b")).define("b", ["Generators", "viewof b"], (G, _) => G.input(_));
  main.variable(observer("viewof tolerance")).define("viewof tolerance", ["Inputs"], _tolerance);
  main.variable(observer("tolerance")).define("tolerance", ["Generators", "viewof tolerance"], (G, _) => G.input(_));
  main.variable(observer("viewof steps")).define("viewof steps", ["Inputs"], _steps);
  main.variable(observer("steps")).define("steps", ["Generators", "viewof steps"], (G, _) => G.input(_));
  main.variable(observer("viewof opts")).define("viewof opts", ["Inputs"], _opts);
  main.variable(observer("opts")).define("opts", ["Generators", "viewof opts"], (G, _) => G.input(_));
  main.define("initial magnets", _magnets);
  main.variable(observer("mutable magnets")).define("mutable magnets", ["Mutable", "initial magnets"], (M, _) => new M(_));
  main.variable(observer("magnets")).define("magnets", ["mutable magnets"], _ => _.generator);
  main.variable(observer("regl")).define("regl", ["stack"], _regl);
  main.define("initial dirty", _dirty);
  main.variable(observer("mutable dirty")).define("mutable dirty", ["Mutable", "initial dirty"], (M, _) => new M(_));
  main.variable(observer("dirty")).define("dirty", ["mutable dirty"], _ => _.generator);
  main.variable(observer("renderLoop")).define("renderLoop", ["mutable dirty","regl","configureAxes","stack","drawField","h","b","mutable magnets","tolerance","invalidation"], _renderLoop);
  main.variable(observer("drawField")).define("drawField", ["regl","steps"], _drawField);
  main.variable(observer("computeTrajectory")).define("computeTrajectory", ["magnets","h","b","opts","ode45"], _computeTrajectory);
  main.define("initial trajectoryStart", _trajectoryStart);
  main.variable(observer("mutable trajectoryStart")).define("mutable trajectoryStart", ["Mutable", "initial trajectoryStart"], (M, _) => new M(_));
  main.variable(observer("trajectoryStart")).define("trajectoryStart", ["mutable trajectoryStart"], _ => _.generator);
  main.define("initial trajectory", ["computeTrajectory","trajectoryStart"], _trajectory);
  main.variable(observer("mutable trajectory")).define("mutable trajectory", ["Mutable", "initial trajectory"], (M, _) => new M(_));
  main.variable(observer("trajectory")).define("trajectory", ["mutable trajectory"], _ => _.generator);
  main.variable(observer("drawSVGLayer")).define("drawSVGLayer", ["stack","d3","mutable trajectoryStart","trajectory","magnets","mutable magnets","mutable dirty"], _drawSVGLayer);
  main.variable(observer("configureAxes")).define("configureAxes", ["createAxisConfiguration","regl"], _configureAxes);
  const child1 = runtime.module(define1);
  main.import("ode45", child1);
  const child2 = runtime.module(define2);
  main.import("reglCanvas", child2);
  const child3 = runtime.module(define3);
  main.import("elementStack", child3);
  main.import("createAxisConfiguration", child3);
  return main;
}
