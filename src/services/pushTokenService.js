import prisma from '../lib/prisma.js';

async function saveToken(userId, token) {
  if (!token || typeof token !== 'string') {
    const error = new Error('token is required');
    error.statusCode = 400;
    throw error;
  }

  return prisma.user.update({
    where: { id: Number(userId) },
    data: { pushToken: token },
    select: { id: true, pushToken: true },
  });
}

async function deleteToken(userId) {
  return prisma.user.update({
    where: { id: Number(userId) },
    data: { pushToken: null },
    select: { id: true, pushToken: true },
  });
}

export default { saveToken, deleteToken };