import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { prisma } from "./db";
import { generateJfEmail } from "./jf-email";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...((process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID) && (process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET)
      ? [GitHub({
          clientId: (process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID)!,
          clientSecret: (process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET)!,
        })]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      const isGoogle = account?.provider === "google";

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: user.email } });
      if (existing) {
        await prisma.user.update({
          where: { email: user.email },
          data: {
            name: user.name,
            image: user.image,
            ...(isGoogle && user.id ? { googleId: user.id } : {}),
          },
        });
        return true;
      }

      // First user becomes owner (serializable to prevent race)
      const created = await prisma.$transaction(async (tx) => {
        const count = await tx.user.count();
        if (count === 0) {
          const jfEmail = await generateJfEmail(user.name, user.email!);
          await tx.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              ...(isGoogle && user.id ? { googleId: user.id } : {}),
              role: "owner",
              jfEmail,
            },
          });
          return true;
        }
        return false;
      }, { isolationLevel: "Serializable" });
      if (created) return true;

      // Check guest invite (priority: invited users get "guest" role)
      const invite = await prisma.guestInvite.findUnique({ where: { email: user.email } });
      if (invite) {
        const jfEmail = await generateJfEmail(user.name, user.email!);
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name,
            image: user.image,
            ...(isGoogle && user.id ? { googleId: user.id } : {}),
            role: "guest",
            jfEmail,
          },
        });
        return true;
      }

      // Access denied — invite code required for all new users
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
