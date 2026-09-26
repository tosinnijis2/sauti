import { z } from "zod";

export const registrationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters."),

    phone: z
      .string()
      .trim()
      .min(7, "Please enter a valid phone number."),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address."),

    password: z
      .string()
      .min(8, "Password must be at least 8 characters."),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password."),

    location: z
      .string()
      .trim()
      .min(2, "Please enter your location."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),

  password: z
    .string()
    .min(1, "Password is required."),
});

export const productSchema = z.object({
  item: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters."),

  category: z
    .string()
    .trim()
    .min(1, "Please select a category."),

  location: z
    .string()
    .trim()
    .min(2, "Please enter a location."),

  price: z.coerce
    .number()
    .positive("Price must be greater than 0."),

  description: z
    .string()
    .trim()
    .min(5, "Description must be at least 5 characters."),
});