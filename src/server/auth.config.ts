import { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "~/server/db";

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // For development purposes, allow a test account
        if (credentials?.email === "test@example.com" && credentials?.password === "password") {
          return { 
            id: "test-user-id", 
            name: "Test User", 
            email: "test@example.com" 
          };
        }

        // Find user with email
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: {
            accounts: {
              where: {
                provider: "credentials"
              },
              take: 1
            }
          }
        });
        
        if (!user || !user.accounts[0]?.refresh_token) {
          return null;
        }
        
        // Verify password (stored in refresh_token)
        const isValidPassword = await compare(
          credentials.password,
          user.accounts[0].refresh_token
        );
        
        if (!isValidPassword) {
          return null;
        }
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image
        };
      }
    })
  ],
  pages: {
    signIn: "/auth/signin",
    newUser: "/auth/signup" 
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.name = token.name as string | null;
        session.user.email = token.email as string | null;
        session.user.image = token.picture as string | null;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = 
        nextUrl.pathname.startsWith('/profile') || 
        nextUrl.pathname.startsWith('/training-packs/upload');
        
      if (isProtected && !isLoggedIn) {
        return false;
      }
      return true;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};