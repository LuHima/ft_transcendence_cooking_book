import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HardDeleteQueryDto } from '../../common/dto/hard-delete-query.dto';
import { DeleteRecipeQueryDto } from './delete-recipe-query.dto';
import { DeleteCommentQueryDto } from './delete-comment-query.dto';

describe('Delete Query DTOs', () => {
  it('accepts boolean and string boolean flags for hard and prune_replies', async () => {
    const hardDto = plainToInstance(HardDeleteQueryDto, { hard: 'true' });
    expect(await validate(hardDto)).toHaveLength(0);
    expect(hardDto.hard).toBe(true);

    const recipeDto = plainToInstance(DeleteRecipeQueryDto, { hard: 'false' });
    expect(await validate(recipeDto)).toHaveLength(0);
    expect(recipeDto.hard).toBe(false);

    const commentDto = plainToInstance(DeleteCommentQueryDto, {
      hard: 'true',
      prune_replies: 'true',
    });
    expect(await validate(commentDto)).toHaveLength(0);
    expect(commentDto.hard).toBe(true);
    expect(commentDto.prune_replies).toBe(true);
  });

  it('rejects non-boolean strings instead of coercing them to false', async () => {
    const badHard = plainToInstance(DeleteRecipeQueryDto, { hard: 'banana' });
    expect((await validate(badHard)).some((e) => e.property === 'hard')).toBe(
      true,
    );

    const badPrune = plainToInstance(DeleteCommentQueryDto, {
      prune_replies: 'yes',
    });
    expect(
      (await validate(badPrune)).some((e) => e.property === 'prune_replies'),
    ).toBe(true);
  });
});
