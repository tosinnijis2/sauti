"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { productSchema } from "@/lib/validation";

export async function createListingAction(formData: FormData) {
  const user = await requireUser();

  const parsed = productSchema.safeParse({
    item: formData.get("item"),
    category: formData.get("category"),
    location: formData.get("location"),
    price: formData.get("price"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ??
      "Please check the product information.";

    redirect(
      `/listings/new?error=${encodeURIComponent(message)}`
    );
  }

  await prisma.product.create({
    data: {
      item: parsed.data.item,
      category: parsed.data.category,
      location: parsed.data.location,
      price: parsed.data.price,
      description: parsed.data.description,
      ownerId: user.id,
    },
  });

  revalidatePath("/listings");

  redirect("/listings?created=1");
}