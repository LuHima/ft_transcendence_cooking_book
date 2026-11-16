import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto } from './create-comment.dto';
import { UpdateCommentDto } from './update-comment.dto';

describe('Comment DTOs', () => {
  it('trims content and rejects whitespace-only comments', async () => {
    const valid = plainToInstance(CreateCommentDto, {
      content: '  Ottima ricetta!  ',
      parent_id: 1,
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.content).toBe('Ottima ricetta!');

    const blankCreate = plainToInstance(CreateCommentDto, { content: '   ' });
    expect((await validate(blankCreate)).length).toBeGreaterThan(0);

    const blankUpdate = plainToInstance(UpdateCommentDto, { content: '   ' });
    expect((await validate(blankUpdate)).length).toBeGreaterThan(0);
  });

  it('rejects out-of-range parent_id values', async () => {
    for (const parent_id of [0, -1, 2147483648]) {
      const dto = plainToInstance(CreateCommentDto, {
        content: 'Ciao',
        parent_id,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'parent_id')).toBe(true);
    }
  });
});
