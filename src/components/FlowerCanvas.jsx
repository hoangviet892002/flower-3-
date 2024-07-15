// src/FlowerCanvas.js
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const FlowerCanvas = () => {
  const canvasRef = useRef();
  const toggleRef = useRef();
  const pointer = useRef({ x: 0.65, y: 0.3, clicked: true });

  const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.);
    }
  `;

  const fragmentShader = `
    uniform float u_ratio;
    uniform vec2 u_point;
    uniform float u_time;
    uniform float u_stop_time;
    uniform vec3 u_stop_randomizer;
    uniform sampler2D u_texture;
    uniform vec3 u_background_color;

    varying vec2 vUv;

    #define PI 3.14159265359

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    float get_dot_shape(vec2 dist, float radius_max, float radius_line) {
        return 1. - smoothstep(radius_line * radius_max, radius_max, dot(dist, dist) * 4.0);
    }

    float get_stem_shape(vec2 _cursor, vec2 _uv, float _t, float _size, float _flowery, vec2 _rand) {
        float stroke_width = .01;
        float noise_power = .2;

        float cursor_horizontal_noise = noise_power * (1. + (1. - _flowery)) * snoise(3. * _uv * (_rand - .5));

        // noise to zero on flower center
        cursor_horizontal_noise *= pow(dot(_cursor.y, _cursor.y), .3 * _flowery);
        cursor_horizontal_noise *= pow(dot(_uv.y, _uv.y), .3);// moise to be zero at bottom
        _cursor.x += cursor_horizontal_noise;

        // non-flowers shorter
        _cursor.y *= (1. - ((1. - _flowery) * .7));
        _cursor.y += ((1. - _flowery) * .7 * _rand.x);

        // non-flowers wider
        stroke_width = (1. - _flowery) * .9 * pow(dot(_uv.y, _cursor.x), 1.) + _flowery * .03;
        stroke_width -= .02;

        float left = smoothstep(-stroke_width, 0., _cursor.x);
        float right = smoothstep(stroke_width, 0., _cursor.x);
        float stem_shape = left * right;

        float stem_top_mask = smoothstep(_cursor.y - .1, _cursor.y, min(-.1, _t - 1.));

        // top ovary
        stem_shape *= stem_top_mask;
        stem_shape += .5 * get_dot_shape(_cursor + vec2(0., .02), .15 * _size, .5);
        stem_shape *= stem_top_mask;

        return stem_shape;
    }

    void main() {
        float speed = 1.3;
        float t = speed * u_stop_time;

        vec2 uv = vUv;
        uv += 0.00007 * snoise(vUv * 6.0 + vec2(0.0, 15.0 * cos(0.1 * u_time)));
        uv.y += 0.00005;

        vec3 color = texture2D(u_texture, uv).xyz;
        color += 0.0015 * u_background_color;

        vec2 cursor = uv - u_point.xy;
        cursor.x *= u_ratio;

        float base_radius = .02 + .2 * u_stop_randomizer.y;
        float grow_duration = .6;
        float grow_speed = 2. * speed;
        float bloom_duration = .3 * u_stop_randomizer.y;

        float is_open = step(.1, base_radius);

        if (t < grow_duration) {
            vec3 stem_color = u_background_color - normalize(vec3(.3, .5, .1));
            float stem_shape = get_stem_shape(cursor, uv, grow_speed * t, base_radius, 1., u_stop_randomizer.xy);
            stem_shape += get_stem_shape(cursor, uv, grow_speed * t, 0., 0., u_stop_randomizer.yz);
            stem_shape += get_stem_shape(cursor, uv, grow_speed * t, 0., 0., u_stop_randomizer.zy);
            vec3 stem = stem_shape * stem_color;
            color -= stem;
        }

        if (t < grow_duration + is_open * bloom_duration) {
            float blooming_time = max(0., pow(1.1 * t, 2.) - .05);
            float radius = base_radius * blooming_time;

            vec2 noisy_cursor = vUv - u_point.xy;
            noisy_cursor.x *= u_ratio;
            noisy_cursor.y *= (1. + u_stop_randomizer.y * is_open);
            noisy_cursor -= .02 * snoise(noisy_cursor * 10. + vec2(0., 10. * sin(.5 * t + PI)));

            // coloring
            vec3 flower_color = u_background_color;
            flower_color -= normalize(vec3(.5 + .5 * sin(2. * u_time), .3, .5 + .5 * sin(2. * u_time + PI)));
            color -= .4 * get_dot_shape(noisy_cursor, 1.5 * radius, .0) * flower_color;

            // masking
            color = .7 * color + .3 * mix(u_background_color, color, 1. - get_dot_shape(noisy_cursor, radius, 0.));

            // big inner white ring
            noisy_cursor.y -= .02;
            float inner_r = .7 * radius;
            float inner_w = .2 * radius;
            float ring_shape = get_dot_shape(noisy_cursor, inner_r + inner_w, .9) - get_dot_shape(noisy_cursor, inner_r, .9);
            color += .2 * blooming_time * ring_shape * step(.1, base_radius);

            // small inner white ring
            inner_r = .4 * radius;
            inner_w = .1 * radius;
            ring_shape = get_dot_shape(noisy_cursor, inner_r + inner_w, .9) - get_dot_shape(noisy_cursor, inner_r, .9);
            color += .1 * pow(t, .5) * ring_shape * step(.1, base_radius);

            // mid dot
            vec2 low_noise_cursor = vUv - u_point.xy;
            low_noise_cursor.x *= .5 * u_ratio;
            low_noise_cursor.y += .02;
            low_noise_cursor += .01 * snoise(low_noise_cursor * 10. + t);
            color -= is_open * pow(t, 5.) * get_dot_shape(low_noise_cursor, .01 * radius, 0.);
        }

        gl_FragColor = vec4(color, 1.0);
    }
  `;

  useEffect(() => {
    let isRendering = true;
    let isStart = true;

    let renderer, shaderScene, mainScene, renderTargets, camera, clock;
    let basicMaterial, shaderMaterial;

    const backgroundColor = new THREE.Color(0xffffff);

    const initScene = () => {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        alpha: true,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      shaderScene = new THREE.Scene();
      mainScene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      clock = new THREE.Clock();

      renderTargets = [
        new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight),
        new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight),
      ];

      const planeGeometry = new THREE.PlaneGeometry(2, 2);

      shaderMaterial = new THREE.ShaderMaterial({
        uniforms: {
          u_ratio: { type: "f", value: window.innerWidth / window.innerHeight },
          u_point: {
            type: "v2",
            value: new THREE.Vector2(pointer.current.x, pointer.current.y),
          },
          u_time: { type: "f", value: 0 },
          u_stop_time: { type: "f", value: 0 },
          u_stop_randomizer: { type: "v3", value: new THREE.Vector2(0, 0, 0) },
          u_texture: { type: "t", value: null },
          u_background_color: { type: "v3", value: backgroundColor },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
      });

      basicMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
      });
      const backgroundColorMaterial = new THREE.MeshBasicMaterial({
        color: backgroundColor,
        transparent: true,
      });

      const planeBasic = new THREE.Mesh(planeGeometry, basicMaterial);
      const planeShader = new THREE.Mesh(planeGeometry, shaderMaterial);
      const coloredPlane = new THREE.Mesh(
        planeGeometry,
        backgroundColorMaterial
      );
      shaderScene.add(planeShader);
      mainScene.add(coloredPlane);

      renderer.setRenderTarget(renderTargets[0]);
      renderer.render(mainScene, camera);

      mainScene.remove(coloredPlane);
      mainScene.add(planeBasic);
    };

    const updateSize = () => {
      shaderMaterial.uniforms.u_ratio.value =
        window.innerWidth / window.innerHeight;
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    const handleClickOrTouch = (e) => {
      e.preventDefault(); // Prevent default touch behavior

      if (e.target !== toggleRef.current) {
        let clientX, clientY;

        if (e.type === "click") {
          clientX = e.clientX;
          clientY = e.clientY;
        } else if (e.type === "touchstart") {
          const touch = e.touches[0];
          clientX = touch.clientX;
          clientY = touch.clientY;
        }

        pointer.current.x = clientX / window.innerWidth;
        pointer.current.y = clientY / window.innerHeight;
        pointer.current.clicked = true;
        isRendering = true;
      } else {
        isRendering = !isRendering;
      }

      toggleRef.current.innerHTML = isRendering ? "freeze" : "unfreeze";
    };

    const render = () => {
      requestAnimationFrame(render);
      const delta = clock.getDelta();

      if (isRendering) {
        shaderMaterial.uniforms.u_texture.value = renderTargets[0].texture;
        shaderMaterial.uniforms.u_time.value = clock.getElapsedTime() + 0.9; // offset for 1st flower color

        if (pointer.current.clicked) {
          shaderMaterial.uniforms.u_point.value = new THREE.Vector2(
            pointer.current.x,
            1 - pointer.current.y
          );
          shaderMaterial.uniforms.u_stop_randomizer.value = new THREE.Vector3(
            Math.random(),
            Math.random(),
            Math.random()
          );
          if (isStart) {
            shaderMaterial.uniforms.u_stop_randomizer.value = new THREE.Vector3(
              0.5,
              1,
              1
            );
            isStart = false;
          }
          shaderMaterial.uniforms.u_stop_time.value = 0;
          pointer.current.clicked = false;
        }
        shaderMaterial.uniforms.u_stop_time.value += delta;

        renderer.setRenderTarget(renderTargets[1]);
        renderer.render(shaderScene, camera);

        basicMaterial.map = renderTargets[1].texture;

        renderer.setRenderTarget(null);
        renderer.render(mainScene, camera);

        let tmp = renderTargets[0];
        renderTargets[0] = renderTargets[1];
        renderTargets[1] = tmp;
      }
    };

    initScene();
    updateSize();
    window.addEventListener("resize", updateSize);
    window.addEventListener("click", handleClickOrTouch);
    window.addEventListener("touchstart", handleClickOrTouch);

    render();

    return () => {
      window.removeEventListener("resize", updateSize);
      window.removeEventListener("click", handleClickOrTouch);
      window.removeEventListener("touchstart", handleClickOrTouch);
    };
  }, []);

  return (
    <div className="container">
      <canvas id="canvas" ref={canvasRef}></canvas>
    </div>
  );
};

export default FlowerCanvas;
