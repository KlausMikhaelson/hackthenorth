-- CreateEnum
CREATE TYPE "public"."OfferStatus" AS ENUM ('CREATED', 'ACCEPTED', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."MintJobStatus" AS ENUM ('PENDING', 'MINTED', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."players" (
    "id" TEXT NOT NULL,
    "xrpl_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nfts" (
    "token_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "uri_hex" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "taxon" INTEGER NOT NULL,
    "flags" INTEGER NOT NULL,
    "transfer_fee_bps" INTEGER,
    "minted_tx_hash" TEXT NOT NULL,
    "minted_ledger_index" INTEGER NOT NULL,
    "current_owner" TEXT NOT NULL,
    "burned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nfts_pkey" PRIMARY KEY ("token_id")
);

-- CreateTable
CREATE TABLE "public"."nft_offers" (
    "offer_id" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "amount_drops" TEXT NOT NULL DEFAULT '0',
    "status" "public"."OfferStatus" NOT NULL DEFAULT 'CREATED',
    "created_tx_hash" TEXT NOT NULL,
    "accepted_tx_hash" TEXT,
    "expiration_unix" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_offers_pkey" PRIMARY KEY ("offer_id")
);

-- CreateTable
CREATE TABLE "public"."nft_mint_jobs" (
    "idempotency_key" TEXT NOT NULL,
    "status" "public"."MintJobStatus" NOT NULL DEFAULT 'PENDING',
    "xrpl_address" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nft_token_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_mint_jobs_pkey" PRIMARY KEY ("idempotency_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_xrpl_address_key" ON "public"."players"("xrpl_address");

-- AddForeignKey
ALTER TABLE "public"."nft_offers" ADD CONSTRAINT "nft_offers_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "public"."nfts"("token_id") ON DELETE RESTRICT ON UPDATE CASCADE;
