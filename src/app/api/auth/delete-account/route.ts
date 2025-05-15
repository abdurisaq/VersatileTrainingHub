import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "~/server/db";
import { getServerAuthSession } from "~/server/auth";


export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const body = await req.json() as { userId: string };
    const { userId } = body;
    
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized: You can only delete your own account" },
        { status: 403 }
      );
    }
    
    await db.$transaction(async (prisma) => {
      // Delete user's comments
      await prisma.comment.deleteMany({
        where: { userId }
      });
      
      await prisma.rating.deleteMany({
        where: { userId }
      });
      
      await prisma.userFavoriteTrainingPack.deleteMany({
        where: { userId }
      });
      
      await prisma.trainingPack.deleteMany({
        where: { creatorId: userId }
      });
      
      await prisma.session.deleteMany({
        where: { userId }
      });
      
      await prisma.account.deleteMany({
        where: { userId }
      });
      
      await prisma.user.delete({
        where: { id: userId }
      });
    });
    
    return NextResponse.json(
      { message: "Account successfully deleted" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}