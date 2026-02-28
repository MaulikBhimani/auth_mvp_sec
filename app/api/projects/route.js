import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

function verifyToken(req) {
  const token = req.headers.get('authorization')?.split(' ')[1];
  if (!token) return null;
  
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

export async function GET(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projects = await prisma.project.findMany({
      where: { userId: decoded.id },
      orderBy: { createdAt: 'desc' }
    });

    return Response.json(projects);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { projectName, config } = await req.json();

    if (!projectName || !config) {
      return Response.json(
        { error: 'Project name and config are required' },
        { status: 400 }
      );
    }

    const cliCommand = `npx stackforge-cli create ${projectName} --config ${config.frontend}-${config.backend}-${config.database}-${config.auth}`;

    const project = await prisma.project.create({
      data: {
        userId: decoded.id,
        projectName,
        config,
        cliCommand,
        status: 'pending'
      }
    });

    return Response.json(
      {
        message: 'Project created successfully',
        project
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
