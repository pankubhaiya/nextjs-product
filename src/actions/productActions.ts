//@ts-nocheck
"use server";

import { sql } from "kysely";
import { DEFAULT_PAGE_SIZE } from "../../constant";
import { db } from "../../db";
import { InsertProducts, UpdateProducts } from "@/types";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/utils/authOptions";
import { cache } from "react";

export async function getProducts(pageNo = 1, pageSize = DEFAULT_PAGE_SIZE) {
  try {
    let products;
    let dbQuery = db.selectFrom("products").selectAll("products");

    const { count } = await dbQuery
      // .select(sql`COUNT(DISTINCT products.id) as count`)
      .executeTakeFirst();

    const lastPage = Math.ceil(count / pageSize);

    products = await dbQuery
      .distinct()
      .offset((pageNo - 1) * pageSize)
      .limit(pageSize)
      .execute();

    const numOfResultsOnCurPage = products.length;

    return { products, count, lastPage, numOfResultsOnCurPage };
  } catch (error) {
    throw error;
  }
}

export const getProduct = cache(async function getProduct(productId: number) {
  // console.log("run");
  try {
    const product = await db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", productId)
      .execute();

    return product;
  } catch (error) {
    return { error: "Could not find the product" };
  }
});

async function enableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 1`.execute(db);
}

async function disableForeignKeyChecks() {
  await sql`SET foreign_key_checks = 0`.execute(db);
}

export async function deleteProduct(productId: number) {
  try {
    await disableForeignKeyChecks();
    await db
      .deleteFrom("product_categories")
      .where("product_categories.product_id", "=", productId)
      .execute();
    await db
      .deleteFrom("reviews")
      .where("reviews.product_id", "=", productId)
      .execute();

    await db
      .deleteFrom("comments")
      .where("comments.product_id", "=", productId)
      .execute();

    await db.deleteFrom("products").where("id", "=", productId).execute();

    await enableForeignKeyChecks();
    revalidatePath("/products");
    return { message: "success" };
  } catch (error) {
    return { error: "Something went wrong, Cannot delete the product" };
  }
}

export async function MapBrandIdsToName(brandsId) {
  const brandsMap = new Map();
  try {
    for (let i = 0; i < brandsId.length; i++) {
      const brandId = brandsId.at(i);
      const brand = await db
        .selectFrom("brands")
        .select("name")
        .where("id", "=", +brandId)
        .executeTakeFirst();
      brandsMap.set(brandId, brand?.name);
    }
    return brandsMap;
  } catch (error) {
    throw error;
  }
}

export async function getAllProductCategories(products: any) {
  try {
    const productsId = products.map((product) => product.id);
    const categoriesMap = new Map();

    for (let i = 0; i < productsId.length; i++) {
      const productId = productsId.at(i);
      const categories = await db
        .selectFrom("product_categories")
        .innerJoin(
          "categories",
          "categories.id",
          "product_categories.category_id"
        )
        .select("categories.name")
        .where("product_categories.product_id", "=", productId)
        .execute();
      categoriesMap.set(productId, categories);
    }
    return categoriesMap;
  } catch (error) {
    throw error;
  }
}

export async function getProductCategories(productId: number) {
  try {
    const categories = await db
      .selectFrom("product_categories")
      .innerJoin(
        "categories",
        "categories.id",
        "product_categories.category_id"
      )
      .select(["categories.id", "categories.name"])
      .where("product_categories.product_id", "=", productId)
      .execute();

    return categories;
  } catch (error) {
    throw error;
  }
}

export async function addProduct(values) {
  try {
    console.log("Form values:", values);

    // Ensure 'price' field is included in the values object
    // values.price = 200;

    // Execute the SQL insert query
    const result = await db
      .insertInto("products")
      .values({
        name: values.name,
        description: values.description,
        price: values.old_price,
        rating: values.rating,
        old_price: values.old_price,
        discount: values.discount,
        colors: values.colors,
        gender: values.gender,
        brands: JSON.stringify(values.brands), // Convert array to string
        occasion: values.occasion.join(","), // Convert array to comma-separated string
        image_url: values.image_url,
      })
      .execute();

    console.log("success:", result);

    // Optionally, revalidate your data if necessary
    revalidatePath("/products");

    return { message: "success" };
  } catch (err) {
    console.error("Error adding product:", err);
    return { error: err.message };
  }
}

export async function updateProduct(
  productId: number,
  values: any
): Promise<{ message?: string; error?: string }> {
  try {
    console.log(productId, values);
    const brandsString = values.brands.map(brand => brand.value).join(',');
    console.log(brandsString)
    const occasionString = await values.occasion.map(occasion => occasion.value).join(",");
    // Execute the SQL update query
    const result = await db
      .updateTable("products")
      .set({
        name: values.name,
        description: values.description,
        price: values.old_price,
        rating: values.rating,
        old_price: values.old_price,
        discount: values.discount,
        colors: values.colors,
        gender: values.gender,
        brands: brandsString,
        occasion: occasionString, // Convert array to comma-separated string
        image_url: values.image_url,
      })
      .where("id", "=", productId)
      .execute();

    console.log("success:", result);

    return { message: "Success" };
  } catch (err) {
    console.error("Error updating product:", err);
    return { error: err.message };
  }
}