import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedFilterGames(db: Database): Promise<{
    categories: number[];
    publishers: number[];
}> {
    const insertedCategories = await db
        .insert(categories)
        .values([
            { name: 'Strategy', description: 'strategy' },
            { name: 'Puzzle', description: 'puzzle' },
        ])
        .returning({ id: categories.id });
    const insertedPublishers = await db
        .insert(publishers)
        .values([
            { name: 'Alpha Games', description: 'alpha' },
            { name: 'Beta Games', description: 'beta' },
        ])
        .returning({ id: publishers.id });

    await db.insert(games).values([
        {
            title: 'Alpha Strategy',
            description: 'strategy from alpha',
            starRating: 4.2,
            categoryId: insertedCategories[0].id,
            publisherId: insertedPublishers[0].id,
        },
        {
            title: 'Beta Puzzle',
            description: 'puzzle from beta',
            starRating: 4.2,
            categoryId: insertedCategories[1].id,
            publisherId: insertedPublishers[1].id,
        },
        {
            title: 'Beta Strategy',
            description: 'strategy from beta',
            starRating: 4.2,
            categoryId: insertedCategories[0].id,
            publisherId: insertedPublishers[1].id,
        },
    ]);

    return {
        categories: insertedCategories.map((category) => category.id),
        publishers: insertedPublishers.map((publisher) => publisher.id),
    };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by any selected category', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getAllGames(db, {
            categoryIds: fixture.categories,
        });

        expect(filtered.map((game) => game.title)).toEqual([
            'Alpha Strategy',
            'Beta Puzzle',
            'Beta Strategy',
        ]);
    });

    it('combines category and publisher filters', async () => {
        const fixture = await seedFilterGames(db);

        const filtered = await getAllGames(db, {
            categoryIds: [fixture.categories[0]],
            publisherId: fixture.publishers[1],
        });

        expect(filtered.map((game) => game.title)).toEqual(['Beta Strategy']);
    });

    it('returns available categories and publishers ordered by name', async () => {
        await seedFilterGames(db);

        expect((await getAllCategories(db)).map((category) => category.name)).toEqual([
            'Puzzle',
            'Strategy',
        ]);
        expect((await getAllPublishers(db)).map((publisher) => publisher.name)).toEqual([
            'Alpha Games',
            'Beta Games',
        ]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
