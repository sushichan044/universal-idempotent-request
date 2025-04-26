import type { DB } from "../db";

import { TB_user, TB_user_profile } from "../db/schema";

type User = {
  id: number;
  profile: {
    name: string;
  };
};

type CreateUserInput = {
  profile: {
    name: string;
  };
};

export const createUser = async (
  database: DB,
  input: CreateUserInput,
): Promise<User> => {
  const user: User = await database.transaction(async (tx) => {
    const baseUser = await tx.insert(TB_user).values({}).returning();

    if (baseUser.length === 0 || baseUser[0] == null) {
      return tx.rollback();
    }

    const userProfile = await tx
      .insert(TB_user_profile)
      .values({
        name: input.profile.name,
        user_id: baseUser[0].id,
      })
      .returning({ name: TB_user_profile.name });

    if (userProfile.length === 0 || userProfile[0] == null) {
      return tx.rollback();
    }

    return {
      id: baseUser[0].id,
      profile: {
        name: userProfile[0].name,
      },
    };
  });

  return user;
};

export const getUser = async (
  database: DB,
  id: number,
): Promise<User | null> => {
  const user = await database.query.TB_user.findFirst({
    where: (fields, { eq }) => {
      return eq(fields.id, id);
    },
    with: {
      profile: {
        columns: {
          name: true,
        },
      },
    },
  });

  return user ?? null;
};

export const getAllUsers = async (database: DB): Promise<User[]> => {
  const users = await database.query.TB_user.findMany({
    with: {
      profile: {
        columns: {
          name: true,
        },
      },
    },
  });

  return users;
};
