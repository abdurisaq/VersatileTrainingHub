import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { getServerAuthSession } from "~/server/auth";

export async function DELETE(req: NextRequest) {
  try {
    // Get the authenticated session
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Get the userId from the request body
    const body = await req.json();
    const { userId } = body;
    
    // Ensure the authenticated user is only deleting their own account
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: "Unauthorized: You can only delete your own account" },
        { status: 403 }
      );
    }
    
    // Start a transaction to delete related data
    await db.$transaction(async (prisma) => {
      // Delete user-related data (you'll need to adjust this based on your schema)
      
      // Delete user's comments
      await prisma.comment.deleteMany({
        where: { userId }
      });
      
      // Delete user's ratings
      await prisma.rating.deleteMany({
        where: { userId }
      });
      
      // Delete user's favorite packs
      await prisma.userFavoriteTrainingPack.deleteMany({
        where: { userId }
      });
      
      // Delete user's training packs
      await prisma.trainingPack.deleteMany({
        where: { creatorId: userId }
      });
      
      // Delete auth-related records (sessions, accounts)
      await prisma.session.deleteMany({
        where: { userId }
      });
      
      await prisma.account.deleteMany({
        where: { userId }
      });
      
      // Finally, delete the user
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