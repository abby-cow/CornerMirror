/**
 * WebGL2 fullscreen quad that samples a video/image texture with fisheye / barrel
 * distortion and a circular mask (convex mirror projection).
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
uniform float u_imageAspect; // width / height
uniform float u_strength;
uniform float u_vignette;
uniform float u_zoom; // sampling scale: smaller = wider FOV (full body), larger = tighter
uniform vec2 u_press;
uniform float u_pressRadius;
uniform float u_pressStrength;
uniform float u_contact;
in vec2 v_uv;
out vec4 outColor;

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) {
    discard;
  }

  float theta = atan(p.y, p.x);
  float rf = pow(r, 0.92);
  // Weaker barrel in enlarged inner zone (portraits); full strength only toward rim
  float edgeW = smoothstep(0.34, 0.66, r);
  float strengthScale = mix(0.3, 1.0, edgeW);
  float distort = 1.0 + u_strength * strengthScale * rf * rf;
  vec2 q = vec2(cos(theta), sin(theta)) * (rf / distort);

  // Local dimple in same mirror-space as q
  vec2 pressRaw = u_press * 2.0 - 1.0;
  float pr = length(pressRaw);
  float pTheta = atan(pressRaw.y, pressRaw.x);
  float pRf = pow(min(pr, 1.0), 0.92);
  float pDistort = 1.0 + u_strength * pRf * pRf;
  vec2 pressP = vec2(cos(pTheta), sin(pTheta)) * (pRf / pDistort);

  vec2 localDelta = q - pressP;
  float localR = length(localDelta);
  // Wider and smoother influence profile (avoid harsh boundary)
  float core = 1.0 - smoothstep(u_pressRadius * 0.14, u_pressRadius * 0.92, localR);
  float shoulder = 1.0 - smoothstep(u_pressRadius * 0.9, u_pressRadius * 1.46, localR);
  core = pow(max(core, 0.0), 1.25);
  shoulder = pow(max(shoulder, 0.0), 1.05);

  // Stiffer street-mirror feel: less stretch near the rim; real domes don't peel at edges.
  float rimGuard = 1.0 - smoothstep(0.68, 0.985, r) * 0.78;

  // Concave center + mild shoulder; overall gain toned vs soft film
  float dimple = u_pressStrength * u_contact * core * rimGuard;
  float shoulderPush = u_pressStrength * u_contact * shoulder * 0.14 * rimGuard;
  q = pressP + localDelta * (1.0 + dimple * 0.62 + shoulderPush);

  vec2 samp;
  if (u_imageAspect >= 1.0) {
    samp.x = q.x / u_imageAspect * u_zoom + 0.5;
    samp.y = q.y * u_zoom + 0.5;
  } else {
    samp.x = q.x * u_zoom + 0.5;
    samp.y = q.y * u_imageAspect * u_zoom + 0.5;
  }

  // Never show void/black at the rim: clamp to valid texels (edge stretch like rigid mirror).
  vec2 sClamp = clamp(samp, vec2(0.001), vec2(0.999));
  vec4 col = texture(u_tex, sClamp);
  float vig = 1.0 - u_vignette * r * r;
  col.rgb *= vig;
  // Contact shading cue: darker pit + slight bright shoulder ring
  float ring = shoulder * (1.0 - core);
  col.rgb *= 1.0 - dimple * 0.2;
  col.rgb += vec3(0.045, 0.05, 0.055) * ring * u_contact;
  float ao = mix(1.0, 0.52, smoothstep(0.32, 1.0, r));
  col.rgb *= ao;
  col.rgb = mix(col.rgb, col.rgb * vec3(0.96, 0.988, 1.04), 0.12);
  outColor = col;
}
`;

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
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

function link(
  gl: WebGL2RenderingContext,
  vs: WebGLShader,
  fs: WebGLShader,
): WebGLProgram {
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

export class FishEyeRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private tex: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private locAspect: WebGLUniformLocation | null;
  private locStrength: WebGLUniformLocation | null;
  private locVignette: WebGLUniformLocation | null;
  private locZoom: WebGLUniformLocation | null;
  private locPress: WebGLUniformLocation | null;
  private locPressRadius: WebGLUniformLocation | null;
  private locPressStrength: WebGLUniformLocation | null;
  private locContact: WebGLUniformLocation | null;
  private raf = 0;
  private source: TexImageSource | null = null;
  public strength = 1.15;
  public vignette = 0.38;
  /** Texture sampling radius; lower = see more scene (e.g. full body). */
  public zoom = 0.5;
  public pressU = 0.5;
  public pressV = 0.5;
  public pressRadius = 0.14;
  public pressStrength = 0.0;
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
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.locAspect = gl.getUniformLocation(this.program, "u_imageAspect");
    this.locStrength = gl.getUniformLocation(this.program, "u_strength");
    this.locVignette = gl.getUniformLocation(this.program, "u_vignette");
    this.locZoom = gl.getUniformLocation(this.program, "u_zoom");
    this.locPress = gl.getUniformLocation(this.program, "u_press");
    this.locPressRadius = gl.getUniformLocation(this.program, "u_pressRadius");
    this.locPressStrength = gl.getUniformLocation(this.program, "u_pressStrength");
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
    const aspect = tw / Math.max(1, th);
    gl.uniform1f(this.locAspect, aspect);
    gl.uniform1f(this.locStrength, this.strength);
    gl.uniform1f(this.locVignette, this.vignette);
    gl.uniform1f(this.locZoom, this.zoom);
    gl.uniform2f(this.locPress, this.pressU, this.pressV);
    gl.uniform1f(this.locPressRadius, this.pressRadius);
    gl.uniform1f(this.locPressStrength, this.pressStrength);
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
