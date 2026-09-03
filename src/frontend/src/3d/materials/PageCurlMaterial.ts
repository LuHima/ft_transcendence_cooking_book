import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import { Texture } from 'three'

export const PageCurlMaterial = shaderMaterial(
  {
    uProgress: 0,
    uPageHeight: 0.28,
    uHingeOffset: 0.025,
    uMapFront: null as Texture | null,
    uMapBack: null as Texture | null,
    uShadowStrength: 0.4,
  },
  // Vertex Shader: Curvatura graduale a parabola per la carta
  /* glsl */ `
    uniform float uProgress;
    uniform float uPageHeight;

    varying vec2 vUv;
    varying vec3 vNormalW;
    varying float vShadow;

    #define PI 3.14159265359

    void main() {
      vUv = uv;
      vec3 pos = position;

      float halfHeight = uPageHeight * 0.5;
      float y_rel = pos.y - halfHeight; 
      float t = clamp(-y_rel / uPageHeight, 0.0, 1.0); 

      // 1. ROTAZIONE ATTORNO ALLA RILEGATURA
      float angle = uProgress * -PI * 0.98;
      float c = cos(angle);
      float s = sin(angle);

      // 2. FLESSIONE ELASTICA DELLA CARTA
      // La piega si sposta lungo il foglio man mano che gira
      float curlFactor = sin(uProgress * PI);
      float arch = sin(t * PI) * 0.08 * curlFactor;

      float rotY = y_rel * c;
      float rotZ = y_rel * s + arch;

      pos.y = rotY + halfHeight;
      pos.z = rotZ;

      // 3. ILLUMINAZIONE SULLA CURVA
      vec3 nrm = normal;
      float nY = nrm.y * c - nrm.z * s;
      float nZ = nrm.y * s + nrm.z * c;

      float archGrad = cos(t * PI) * PI * 0.08 * curlFactor;
      vec3 curlNormal = normalize(vec3(nrm.x, nY - archGrad * s, nZ + archGrad * c));

      vNormalW = normalize(normalMatrix * curlNormal);
      vShadow = curlFactor * sin(t * PI);

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  // Fragment Shader: Gestione fronte/retro e resa grafica pulita
  /* glsl */ `
    uniform sampler2D uMapFront;
    uniform sampler2D uMapBack;
    uniform float uShadowStrength;

    varying vec2 vUv;
    varying vec3 vNormalW;
    varying float vShadow;

    void main() {
      bool isBack = !gl_FrontFacing;

      // Coordinate UV corrette per fronte e retro
      vec2 uv = isBack ? vec2(vUv.x, 1.0 - vUv.y) : vUv;
      
      // Campionamento texture
      vec4 texFront = texture2D(uMapFront, uv);
      vec4 texBack  = texture2D(uMapBack, uv);
      vec4 tex = isBack ? texBack : texFront;

      // Gestione colore di fallback se la texture sul retro non è ancora pronta
      if (isBack && tex.a < 0.1) {
        tex = vec4(0.96, 0.95, 0.92, 1.0); // Colore carta naturale
      }

      vec3 norm = normalize(vNormalW);
      if (isBack) norm = -norm;

      // Luce direzionale morbida
      vec3 lightDir = normalize(vec3(0.3, 0.7, 1.0));
      float diff = max(dot(norm, lightDir), 0.45);

      // Ombra lungo il punto di flessione
      float shadowEffect = 1.0 - (vShadow * uShadowStrength * 0.35);

      gl_FragColor = vec4(tex.rgb * diff * shadowEffect, 1.0);
    }
  `
)

extend({ PageCurlMaterial })