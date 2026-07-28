import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import { Texture } from 'three'

export const PageCurlMaterial = shaderMaterial(
    {
        uProgress: 0,
        uRadius: 0.06,
        uPageWidth: 0.39,
        uMapFront: null as Texture | null,
        uMapBack: null as Texture | null,
        uShadowStrength: 0.5,
    },
    	// vertex shader
	/* glsl */ `
    uniform float uProgress;
    uniform float uRadius;
    uniform float uPageWidth;

    varying vec2 vUv;
    varying float vCurlAngle;
    varying vec3 vNormalW;

    void main() {
      vUv = uv;
      vec3 pos = position;
      vec3 nrm = normal;

      // hinge in x = 0, la pagina si estende verso +x
      float hingeDist = pos.x;

      // il punto dove inizia la curva si sposta da destra verso sinistra
      float curlStart = mix(uPageWidth, -uPageWidth * 0.05, uProgress);

      float d = hingeDist - curlStart;

      if (d > 0.0) {
        float theta = min(d / uRadius, 3.14159265);

        pos.x = curlStart + uRadius * sin(theta);
        pos.z += uRadius * (1.0 - cos(theta));

        nrm.x = normal.x * cos(theta) - normal.z * sin(theta);
        nrm.z = normal.x * sin(theta) + normal.z * cos(theta);

        vCurlAngle = theta;
      } else {
        vCurlAngle = 0.0;
      }

      vNormalW = normalize(normalMatrix * nrm);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
	// fragment shader
	/* glsl */ `
    uniform sampler2D uMapFront;
    uniform sampler2D uMapBack;
    uniform float uShadowStrength;

    varying vec2 vUv;
    varying float vCurlAngle;
    varying vec3 vNormalW;

    void main() {
      bool back = !gl_FrontFacing;
      vec2 uv = back ? vec2(1.0 - vUv.x, vUv.y) : vUv;
      vec4 tex = back ? texture2D(uMapBack, uv) : texture2D(uMapFront, uv);

      // ombra procedurale sulla piega (max scurimento verso theta = PI/2)
      float shadow = 1.0 - sin(min(vCurlAngle, 1.5708)) * uShadowStrength;

      vec3 lightDir = normalize(vec3(0.3, 0.5, 1.0));
      float diff = max(dot(normalize(vNormalW), lightDir), 0.35);

      gl_FragColor = vec4(tex.rgb * shadow * diff, tex.a);
    }
  `
)

extend({ PageCurlMaterial })