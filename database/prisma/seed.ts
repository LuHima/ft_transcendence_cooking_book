import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const mario = await prisma.user.upsert({
    where: { email: 'marghe@example.com' },
    update: {},
    create: {
      username: 'marghe_dallolio',
      email: 'marghe@example.com',
      password_hash: passwordHash,
    },
  });

  const giulia = await prisma.user.upsert({
    where: { email: 'mario@example.com' },
    update: {},
    create: {
      username: 'mario_bianchi',
      email: 'mario@example.com',
      password_hash: passwordHash,
    },
  });

  const pasta = await prisma.ingredient.upsert({
    where: { name: 'Pasta' }, update: {}, create: { name: 'Pasta' },
  });
  const pomodoro = await prisma.ingredient.upsert({
    where: { name: 'Pomodoro' }, update: {}, create: { name: 'Pomodoro' },
  });
  const basilico = await prisma.ingredient.upsert({
    where: { name: 'Basilico' }, update: {}, create: { name: 'Basilico' },
  });
  const uova = await prisma.ingredient.upsert({
    where: { name: 'Uova' }, update: {}, create: { name: 'Uova' },
  });
  const guanciale = await prisma.ingredient.upsert({
    where: { name: 'Guanciale' }, update: {}, create: { name: 'Guanciale' },
  });
  const pecorino = await prisma.ingredient.upsert({
    where: { name: 'Pecorino Romano' }, update: {}, create: { name: 'Pecorino Romano' },
  });

  const carbonara = await prisma.recipe.create({
    data: {
      user_id: mario.id,
      title: 'Pasta alla Carbonara',
      description: 'La vera carbonara romana, cremosa e saporita.',
      instructions: '1. Cuoci la pasta. 2. Rosola il guanciale. 3. Mescola uova e pecorino. 4. Unisci tutto fuori dal fuoco.',
      prep_time: 30,
      recipe_ingredients: {
        create: [
          { ingredient_id: pasta.id, quantity: 320, unit: 'g' },
          { ingredient_id: uova.id, quantity: 4, unit: 'pz' },
          { ingredient_id: guanciale.id, quantity: 150, unit: 'g' },
          { ingredient_id: pecorino.id, quantity: 80, unit: 'g' },
        ],
      },
    },
  });

  const sughetto = await prisma.recipe.create({
    data: {
      user_id: giulia.id,
      title: 'Sugo al Pomodoro Fresco',
      description: 'Salsa di pomodoro fresca e profumata al basilico.',
      instructions: '1. Taglia i pomodori. 2. Soffriggi aglio. 3. Aggiungi pomodori e cuoci 20 min. 4. Aggiungi basilico.',
      prep_time: 25,
      recipe_ingredients: {
        create: [
          { ingredient_id: pomodoro.id, quantity: 500, unit: 'g' },
          { ingredient_id: basilico.id, quantity: 10, unit: 'g' },
        ],
      },
    },
  });

  const comment1 = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: giulia.id,
      content: 'Ricetta fantastica! La farò stasera.',
    },
  });

  await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: mario.id,
      parent_id: comment1.id,
      content: "Grazie! Fammi sapere com'è venuta 😊",
    },
  });

  await prisma.comment.create({
    data: {
      recipe_id: sughetto.id,
      user_id: mario.id,
      content: 'Semplice ma buonissimo!',
    },
  });

  await prisma.like.createMany({
    data: [
      { user_id: giulia.id, recipe_id: carbonara.id },
      { user_id: mario.id, recipe_id: sughetto.id },
    ],
    skipDuplicates: true,
  });

  const mealPlan = await prisma.mealPlan.create({
    data: {
      user_id: mario.id,
      start_date: new Date('2026-06-23'),
      end_date: new Date('2026-06-27'),
      meal_plan_recipes: {
        create: [
          { recipe_id: carbonara.id, planned_date: new Date('2026-06-23'), meal_type: 'lunch' },
          { recipe_id: sughetto.id, planned_date: new Date('2026-06-24'), meal_type: 'dinner' },
        ],
      },
    },
  });

  await prisma.shoppingList.create({
    data: {
      user_id: mario.id,
      meal_plan_id: mealPlan.id,
      items: {
        create: [
          { ingredient_id: pasta.id, quantity: 320, unit: 'g' },
          { ingredient_id: uova.id, quantity: 4, unit: 'pz' },
          { ingredient_id: guanciale.id, quantity: 150, unit: 'g' },
          { ingredient_id: pecorino.id, quantity: 80, unit: 'g' },
          { ingredient_id: pomodoro.id, quantity: 500, unit: 'g' },
          { ingredient_id: basilico.id, quantity: 10, unit: 'g' },
        ],
      },
    },
  });

  console.log('Seed completato!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });