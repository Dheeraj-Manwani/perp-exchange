import { prisma } from "@repo/db";

export const getUserByUsername = async (username: string) => {
  return await prisma.user.findUnique({
    where: {
      username,
    },
  });
};

export const getUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: {
      id,
    },
  });
};

export const createUser = async (username: string, password: string) => {
  return await prisma.user.create({
    data: {
      username,
      passwordHash: password,
    },
  });
};
