

interface RecipeCardProps {
	title: string
	difficulty: string
	author: string
}

function RecipeCard({ title, difficulty, author }: RecipeCardProps) {
	return (
		<div>
			<h2>{title}</h2>
			<p>{difficulty}</p>
			<p>{author}</p>
		</div>
	)
}

export default RecipeCard