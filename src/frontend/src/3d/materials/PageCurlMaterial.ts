import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'
import { Texture } from 'three'

// materiale personalizzato per la piega delle pagine
// uProgress: controlla quanto la pagina è piegata
// uRadius: raggio della curva della pagina
// uPageWidth: larghezza della pagina
// uMapFront / uMapBack: texture per fronte e retro pagina
// uShadowStrength: intensità dell'ombra sulla piega
export const PageCurlMaterial = shaderMaterial(
    {
        uProgress: 0,
				uPageHeight: 0.28,
				uHingeOffset: 0.025, // stesso valore di -0.025 usato per hingeRef in Book.tsx
				uMapFront: null as Texture | null,
				uMapBack: null as Texture | null,
        uShadowStrength: 0.5,
    },
    	// vertex shader: qui viene calcolata la deformazione della pagina durante la piega
	/* glsl */ `
		// vertex shader — togli uHingeOffset dal pivot
		uniform float uProgress;
		uniform float uPageHeight;

		varying vec2 vUv;
		varying vec3 vNormalW;

		void main() {
			vUv = uv;
			vec3 pos = position;
			vec3 nrm = normal;

			float halfHeight = uPageHeight * 0.5;
			float y = pos.y - halfHeight;
			float z = pos.z; // niente più offset qui

			float theta = uProgress * -3.14159265;
			float c = cos(theta);
			float s = sin(theta);

			float rotY = y * c - z * s;
			float rotZ = y * s + z * c;

			pos.y = rotY + halfHeight;
			pos.z = rotZ;

			nrm.y = normal.y * c - normal.z * s;
			nrm.z = normal.y * s + normal.z * c;

			vNormalW = normalize(normalMatrix * nrm);

			vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
			gl_Position = projectionMatrix * mvPosition;
		}
  `,
	// fragment shader: decide il colore finale della pagina in base al fronte/retro e all'illuminazione
	/* glsl */ `
		uniform sampler2D uMapFront;
		uniform sampler2D uMapBack;

		varying vec2 vUv;
		varying vec3 vNormalW;

		void main() {
			bool back = !gl_FrontFacing;
			vec2 uv = back ? vec2(1.0 - vUv.x, vUv.y) : vUv;
			vec4 tex = back ? texture2D(uMapBack, uv) : texture2D(uMapFront, uv);

			vec3 lightDir = normalize(vec3(0.3, 0.5, 1.0));
			float diff = max(dot(normalize(vNormalW), lightDir), 0.35);

			gl_FragColor = vec4(tex.rgb * diff, tex.a);
		}
  `
)

extend({ PageCurlMaterial })