/**
 * WebGL2 convex mirror renderer:
 * 1) global fisheye projection (convex mirror look)
 * 2) local fingertip dimple (concave press) layered on top
 */

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_press;
uniform float u_radius;
uniform float u_strength;
uniform float u_aspect;
uniform float u_imageAspect;
uniform float u_fisheye;
uniform float u_zoom;
uniform float u_vignette;
uniform float u_contact;
in vec2 v_uv;
out vec4 o;

void main() {
  // Circular mirror mask in screen space
  vec2 p = v_uv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) {
    discard;
  }

  // Base convex-mirror fisheye mapping
  float theta = atan(p.y, p.x);
  float rf = pow(r, 0.92);
  float distort = 1.0 + u_fisheye * rf * rf;
  vec2 q = vec2(cos(theta), sin(theta)) * (rf / distort);

  // Map fingertip to the SAME fisheye mirror space as q, otherwise the dimple
  // center drifts away from the finger and feels "no effect".
  vec2 pressRaw = u_press * 2.0 - 1.0;
  float pr = length(pressRaw);
  float pTheta = atan(pressRaw.y, pressRaw.x);
  float pRf = pow(min(pr, 1.0), 0.92);
  float pDistort = 1.0 + u_fisheye * pRf * pRf;
  vec2 pressP = vec2(cos(pTheta), sin(pTheta)) * (pRf / pDistort);
  vec2 localDelta = q - pressP;
  vec2 localMetric = vec2(localDelta.x * u_aspect, localDelta.y);
  float localDist = length(localMetric);
  float localW = 1.0 - smoothstep(u_radius * 0.3, u_radius, localDist);
  localW *= localW;

  // Concave dimple: expand rays away from contact center + center darkening
  float dimple = u_strength * localW * u_contact;
  vec2 dir = normalize(localDelta + vec2(1e-5, 1e-5));
  q = pressP + localDelta * (1.0 + dimple * 0.72);

  // Outer rebound ring: slight inverse bulge around the dimple
  float ringIn = smoothstep(u_radius * 0.58, u_radius * 0.96, localDist);
  float ringOut = 1.0 - smoothstep(u_radius * 0.96, u_radius * 1.36, localDist);
  float rebound = ringIn * ringOut * u_strength * u_contact;
  q -= dir * rebound * 0.06;

  vec2 samp;
  if (u_imageAspect >= 1.0) {
    samp.x = q.x / u_imageAspect * u_zoom + 0.5;
    samp.y = q.y * u_zoom + 0.5;
  } else {
    samp.x = q.x * u_zoom + 0.5;
    samp.y = q.y * u_imageAspect * u_zoom + 0.5;
  }

  if (samp.x < 0.0 || samp.x > 1.0 || samp.y < 0.0 || samp.y > 1.0) {
    o = vec4(0.03, 0.04, 0.06, 1.0);
    return;
  }
  vec4 col = texture(u_tex, samp);
  float vig = 1.0 - u_vignette * r * r;
  col.rgb *= vig;
  col.rgb *= 1.0 - dimple * 0.18;
  col.rgb += vec3(0.06, 0.07, 0.08) * rebound;
  o = col;
}
`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh) ?? "";
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error("program");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.bindAttribLocation(prog, 0, "a_pos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) ?? "";
    gl.deleteProgram(prog);
    throw new Error(log);
  }
  return prog;
}

export class PressMirrorRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private locPress: WebGLUniformLocation | null;
  private locRadius: WebGLUniformLocation | null;
  private locStrength: WebGLUniformLocation | null;
  private locAspect: WebGLUniformLocation | null;
  private locImageAspect: WebGLUniformLocation | null;
  private locFisheye: WebGLUniformLocation | null;
  private locZoom: WebGLUniformLocation | null;
  private locVignette: WebGLUniformLocation | null;
  private locContact: WebGLUniformLocation | null;
  private raf = 0;
  private source: TexImageSource | null = null;

  public pressU = 0.5;
  public pressV = 0.5;
  /** Radius in UV space using min(w,h) as unit (aspect-corrected in shader). */
  public pressRadius = 0.12;
  /** 0 = flat, 1 = strong local dimple. */
  public pressStrength = 0.0;
  public fisheye = 0.76;
  public zoom = 0.5;
  public vignette = 0.2;
  public contact = 0.0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL2 not available");
    this.gl = gl;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    this.program = link(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.locPress = gl.getUniformLocation(this.program, "u_press");
    this.locRadius = gl.getUniformLocation(this.program, "u_radius");
    this.locStrength = gl.getUniformLocation(this.program, "u_strength");
    this.locAspect = gl.getUniformLocation(this.program, "u_aspect");
    this.locImageAspect = gl.getUniformLocation(this.program, "u_imageAspect");
    this.locFisheye = gl.getUniformLocation(this.program, "u_fisheye");
    this.locZoom = gl.getUniformLocation(this.program, "u_zoom");
    this.locVignette = gl.getUniformLocation(this.program, "u_vignette");
    this.locContact = gl.getUniformLocation(this.program, "u_contact");
  }

  setSource(src: TexImageSource | null) {
    this.source = src;
  }

  resize(w: number, h: number) {
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const cw = Math.max(2, Math.floor(w * dpr));
    const ch = Math.max(2, Math.floor(h * dpr));
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
  }

  private drawFrame = () => {
    const gl = this.gl;
    const src = this.source;
    if (!src || !("width" in src)) {
      this.raf = requestAnimationFrame(this.drawFrame);
      return;
    }
    const tw = "videoWidth" in src ? src.videoWidth : src.width;
    const th = "videoHeight" in src ? src.videoHeight : src.height;
    if (tw <= 0 || th <= 0) {
      this.raf = requestAnimationFrame(this.drawFrame);
      return;
    }

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.04, 0.05, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    gl.useProgram(this.program);
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const imageAspect = tw / Math.max(1, th);
    gl.uniform2f(this.locPress, this.pressU, this.pressV);
    gl.uniform1f(this.locRadius, this.pressRadius);
    gl.uniform1f(this.locStrength, this.pressStrength);
    gl.uniform1f(this.locAspect, aspect);
    gl.uniform1f(this.locImageAspect, imageAspect);
    gl.uniform1f(this.locFisheye, this.fisheye);
    gl.uniform1f(this.locZoom, this.zoom);
    gl.uniform1f(this.locVignette, this.vignette);
    gl.uniform1f(this.locContact, this.contact);

    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    this.raf = requestAnimationFrame(this.drawFrame);
  };

  start() {
    this.stop();
    this.raf = requestAnimationFrame(this.drawFrame);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose() {
    this.stop();
    this.gl.deleteTexture(this.tex);
    this.gl.deleteProgram(this.program);
    this.gl.deleteVertexArray(this.vao);
  }
}
