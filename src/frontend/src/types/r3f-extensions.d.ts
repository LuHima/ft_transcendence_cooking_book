import { Object3DNode } from '@react-three/fiber'
import { PageCurlMaterial } from '../3d/materials/PageCurlMaterial'

declare global {
	namespace JSX {
		interface IntrinsicElements {
			pageCurlMaterial: Object3DNode<InstanceType<typeof PageCurlMaterial>, typeof PageCurlMaterial>
		}
	}
}