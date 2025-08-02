import { auth } from "@clerk/nextjs/server";

export async function GET () {
	const data = await auth()

	return new Response(JSON.stringify(data), {
		status: 200,
		headers: {
			"Content-Type": "application/json",
		},
	});
}