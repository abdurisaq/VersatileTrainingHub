import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { hash } from "bcryptjs";
import { z } from "zod";

// Validation schema
const userSchema = z.object({
  name: z.string().min(2, "Username must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate input
    const validatedData = userSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validatedData.error.format() },
        { status: 400 }
      );
    }
    
    const { name, email, password } = validatedData.data;
    
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }
    
    // Hash the password
    const hashedPassword = await hash(password, 10);
    
    // Create the user
    const user = await db.user.create({
      data: {
        name,
        email,
        // Store password in the user's first account credential
        accounts: {
          create: {
            type: "credentials",
            provider: "credentials",
            providerAccountId: email,
            // Store hashed password in the refresh_token field for now
            refresh_token: hashedPassword
          }
        }
      },
    });
    
    return NextResponse.json(
      { 
        message: "User registered successfully",
        userId: user.id
      }, 
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}