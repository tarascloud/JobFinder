import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [GitHub({
          clientId: process.env.GITHUB_ID!,
          clientSecret: process.env.GITHUB_SECRET!,
        })]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) {
        await prisma.user.update({
          where: { email: user.email },
          data: { name: user.name, image: user.image },
        });
        return true;
      }

      // First user becomes owner (serializable to prevent race)
      const created = await prisma.$transaction(async (tx) => {
        const count = await tx.user.count();
        if (count === 0) {
          await tx.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              googleId: user.id,
              role: "owner",
            },
          });
          return true;
        }
        return false;
      }, { isolationLevel: "Serializable" });
      if (created) return true;

      // Check guest invite
      const invite = await prisma.guestInvite.findUnique({ where: { email: user.email } });
      if (invite) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            image: user.image,
            googleId: user.id,
            role: "guest",
          },
        });
        return true;
      }

      // Not invited — deny access
      return false;
    },
    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (dbUser) {
          (session.user as unknown as Record<string, unknown>).dbId = dbUser.id;
          (session.user as unknown as Record<string, unknown>).role = dbUser.role;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = String(user.id);
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
});
