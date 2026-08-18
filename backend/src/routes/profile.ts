// Profile routes: view a user's public profile, update your own profile.
// Mounted under /api/profile by server.ts. Every route requires login.


import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma.js";
import { authedUserId, requireAuth } from "../lib/requireAuth.js";
import { isOnline } from "../lib/wsRegistry.js";

//the same displayName rules as in signup
const updateProfileSchema = z.object({
    displayName: z
        .string()
        .min(1, "Display name is required")
        .max(50, "Display name too long")
        .trim(),
});

export async function profileRoutes(fastify:FastifyInstance) {
    //plugin-wide quard: requireAuth fisrt check before go to every route
    fastify.addHook("preHandler", requireAuth);

    fastify.patch("/", async (request, reply) =>{
        const parsed = updateProfileSchema.safeParse(request.body);
        if (!parsed.success){
            return reply.code(400).send({
                error: "Invalid input",
                details: parsed.error.flatten().fieldErrors,
            });
        }

        const me = authedUserId(request);
        const user = await prisma.user.update({
            where: { id: me },
            data: { displayName: parsed.data.displayName },
            select: { id: true, email: true, displayName: true, avatarUrl : true },
        });
        return reply.send ({ user });
    });

    fastify.get("/:id", async (request, reply) => {
        const params = z
            .object({ id: z.string().uuid()})
            .safeParse(request.params);
        if (!params.success){
            return reply.code(404).send({ error: "User not found"});
        }

        const user = await prisma.user.findUnique({
            where: { id: params.data.id },
            //ONLY public fields (no passwordHash, no email)
            select: {id: true, displayName: true, avatarUrl: true },
        });
        if (!user ){
            return reply.code(404).send({ error: "User not found " });
        }
        // not stored, it is online from WebSocket registry
        return reply.send({ user: { ...user, online: isOnline(user.id) } });
    });
}