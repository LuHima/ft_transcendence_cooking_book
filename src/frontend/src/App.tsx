import KitchenScene from './3d/KitchenScene'

function App() {
	return (
		<div className='w-screen h-screen flex bg-black'>
			{/* Scena 3D a sinistra (70%) */}
            <div className='w-screen h-screen'>
                <KitchenScene />
            </div>
		</div>
	)
}

export default App