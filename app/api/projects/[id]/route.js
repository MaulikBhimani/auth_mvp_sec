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

export async function GET(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // params in App Router route handlers can be a Promise; unwrap it
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: {
        id: id,
        userId: decoded.id
      }
    });

    if (!project) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return Response.json(project);
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { projectName, config } = await req.json();

    const { id } = await params;

    const project = await prisma.project.updateMany({
      where: {
        id: id,
        userId: decoded.id
      },
      data: {
        projectName,
        config,
        updatedAt: new Date()
      }
    });

    if (project.count === 0) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return Response.json({
      message: 'Project updated successfully'
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const project = await prisma.project.deleteMany({
      where: {
        id: id,
        userId: decoded.id
      }
    });

    if (project.count === 0) {
      return Response.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return Response.json({
      message: 'Project deleted successfully'
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
