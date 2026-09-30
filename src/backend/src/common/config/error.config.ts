import { HttpStatus, HttpException } from '@nestjs/common';

export interface AppErrorDefinition {
  statusCode: HttpStatus; // numero dell'errore
  message: string;	// messaggio dell'errore
  error?: string; // tipo di chiamata dell'errore tipo 'Not Found', 'Unauthorized', 'Bad Request'
}

export const errors = {
  // ─────────────────────────────────────────────────────────
  // ERRORI COMUNI E DI SISTEMA
  // ─────────────────────────────────────────────────────────
  common: {
	validationFailed: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Validation failed',
		error: 'Bad Request',
	},
	emptyBody: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'The request body cannot be empty',
		error: 'Bad Request',
	},
	badRequest: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Bad request',
		error: 'Bad Request',
	},
	unauthorized: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Unauthorized access',
		error: 'Unauthorized',
	},
	forbidden: {
		statusCode: HttpStatus.FORBIDDEN,
		message: 'You do not have permission to perform this action',
		error: 'Forbidden',
	},
	notFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Resource not found',
		error: 'Not Found',
	},
	internalServerError: {
		statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
		message: 'An unexpected internal server error occurred',
		error: 'Internal Server Error',
	},
	},

	// ─────────────────────────────────────────────────────────
	// AUTENTICAZIONE E SESSIONI (JWT)
	// ─────────────────────────────────────────────────────────
	auth: {
	invalidCredentials: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Invalid password or email',
		error: 'Unauthorized',
	},
	emailAlreadyUsed: {
		statusCode: HttpStatus.CONFLICT,
		message: 'Email is already used',
		error: 'Conflict',
	},
	usernameAlreadyUsed: {
		statusCode: HttpStatus.CONFLICT,
		message: 'Username is already used',
		error: 'Conflict',
	},
	emailOrUsernameAlreadyUsed: {
		statusCode: HttpStatus.CONFLICT,
		message: 'Email or username already in use',
		error: 'Conflict',
	},
	tokenMissing: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Access token is missing',
		error: 'Unauthorized',
	},
	tokenExpired: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Access token expired',
		error: 'Unauthorized',
	},
	tokenInvalid: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Invalid access token',
		error: 'Unauthorized',
	},
	refreshTokenMissing: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Refresh token missing',
		error: 'Unauthorized',
	},
	refreshTokenExpired: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Refresh token expired or invalid',
		error: 'Unauthorized',
	},
	refreshTokenInvalid: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Invalid refresh token',
		error: 'Unauthorized',
	},
	accessDenied: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Access denied',
		error: 'Unauthorized',
	},
	sessionExpired: {
		statusCode: HttpStatus.UNAUTHORIZED,
		message: 'Session has expired, please sign in again',
		error: 'Unauthorized',
	},
	},

	// ─────────────────────────────────────────────────────────
	// UTENTI
	// ─────────────────────────────────────────────────────────
	users: {
	notFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'User not found',
		error: 'Not Found',
	},
	alreadyExists: {
		statusCode: HttpStatus.CONFLICT,
		message: 'User already exists',
		error: 'Conflict',
	},
	inactive: {
		statusCode: HttpStatus.FORBIDDEN,
		message: 'User account is inactive or disabled',
		error: 'Forbidden',
	},
	cannotDeleteSelf: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'You cannot delete your own account',
		error: 'Bad Request',
	},
	updateFailed: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Failed to update user profile',
		error: 'Bad Request',
	},
	},

	// ─────────────────────────────────────────────────────────
	// RICETTE
	// ─────────────────────────────────────────────────────────
	recipes: {
	notFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Recipe not found',
		error: 'Not Found',
	},
	recipesNotFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Recipes not found',
		error: 'Not Found',
	},
	invalidPage: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Page number must be greater than 0',
		error: 'Bad Request',
	},
	notOwner: {
		statusCode: HttpStatus.FORBIDDEN,
		message: 'You do not have permission to modify or delete this recipe',
		error: 'Forbidden',
	},
	createFailed: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Failed to create recipe',
		error: 'Bad Request',
	},
	updateFailed: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Failed to update recipe',
		error: 'Bad Request',
	},
	deleteFailed: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Failed to delete recipe',
		error: 'Bad Request',
	},
	},

	// ─────────────────────────────────────────────────────────
	// INGREDIENTI
	// ─────────────────────────────────────────────────────────
	ingredients: {
	notFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Ingredient not found',
		error: 'Not Found',
	},
	alreadyExists: {
		statusCode: HttpStatus.CONFLICT,
		message: 'Ingredient with this name already exists',
		error: 'Conflict',
	},
	invalidQuantity: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Ingredient quantity must be greater than 0',
		error: 'Bad Request',
	},
	},

	// ─────────────────────────────────────────────────────────
	// COMMENTI
	// ─────────────────────────────────────────────────────────
	comments: {
	notFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Comment not found',
		error: 'Not Found',
	},
	parentNotFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Parent comment not found',
		error: 'Not Found',
	},
	notOwner: {
		statusCode: HttpStatus.FORBIDDEN,
		message: 'You can only edit or delete your own comments',
		error: 'Forbidden',
	},
	},

	// ─────────────────────────────────────────────────────────
	// PIANI PASTI (MEAL PLANS)
	// ─────────────────────────────────────────────────────────
	mealPlans: {
	notFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Meal plan not found',
		error: 'Not Found',
	},
	invalidDateRange: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Meal plan end date must be after start date',
		error: 'Bad Request',
	},
	notOwner: {
		statusCode: HttpStatus.FORBIDDEN,
		message: 'You do not have permission to modify this meal plan',
		error: 'Forbidden',
	},
	},

	// ─────────────────────────────────────────────────────────
	// DATABASE / PRISMA
	// ─────────────────────────────────────────────────────────
	database: {
	uniqueConstraint: {
		statusCode: HttpStatus.CONFLICT,
		message: 'A unique constraint was violated on this field',
		error: 'Conflict',
	},
	recordNotFound: {
		statusCode: HttpStatus.NOT_FOUND,
		message: 'Record not found in the database',
		error: 'Not Found',
	},
	foreignKeyFailed: {
		statusCode: HttpStatus.BAD_REQUEST,
		message: 'Related record was not found (foreign key constraint failed)',
		error: 'Bad Request',
	},
	queryError: {
		statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
		message: 'Database query execution error',
		error: 'Internal Server Error',
	},
	generalPrismaError: {
		statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
		message: 'Database query execution error',
		error: 'Internal Server Error',
	},
	},
	} as const;
	
//	 creo questa funzione per creare degli exeption che mi servono	
	export function createHttpException(errorDef: AppErrorDefinition, customMessage?: string): HttpException {

		// HttpException è una classe che richiede 3 parametri HttpException(response, status, options?)
		// io gli passo un oggetto e uno status, l'option lo ometto
		return new HttpException(
		{
			statusCode: errorDef.statusCode,
			message: customMessage || errorDef.message,
			error: errorDef.error,
		},
		errorDef.statusCode,
		);
	}