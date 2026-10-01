-- MySQL dump 10.13  Distrib 8.0.40, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: marcon_almox
-- ------------------------------------------------------
-- Server version	8.0.40

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES ('1f415c40-5e4a-46b6-a876-9c10cdf2b656','deb2c4e587316718a6bd27dbbb582757fe7e09652bfaf903c9884a70f3b38c6b','2026-09-30 17:19:51.654','20260930120000_add_rbac_and_audit','',NULL,'2026-09-30 17:19:51.654',0),('7651637b-6bec-405b-b914-75efc7b1ceae','b6c24bc6e8ef84542a2d7d6d4edd6f2694525200e7858b529389fd1d0677878c','2026-09-30 20:11:17.679','20260930110000_initial_schema','',NULL,'2026-09-30 20:11:17.679',0),('a5b7915a-4135-437e-8a87-bf7d9ad7cd5e','9c56bb90776799eff90d24ced08b6f48c5b38e7a577a2869e989e62de6858fb7','2026-09-30 17:20:17.387','20260930150000_admin_password_not_required','',NULL,'2026-09-30 17:20:17.387',0),('a5b8d87e-32f2-4f51-a4f7-a6fe5e2fd005','7b675f5b1dea368b6ab92590ed8bb8a78b1a6bf06084241d80bd7f91dcd6c57f','2026-10-01 12:14:21.421','20261001100000_deposito_de_sobras',NULL,NULL,'2026-10-01 12:14:21.184',1),('b8491059-5e10-4514-9ffe-853d64a344c3','1fa10dc914a6ec8a0f0a0775bfc65ceeb8cfa2d20820c11110d33d09ab2cd82c','2026-09-30 17:20:30.639','20260930160000_add_stock_packaging_details',NULL,NULL,'2026-09-30 17:20:30.602',1),('dc54f152-313c-4490-8bb4-2af2f5a2c5df','923bcaff4ebd9f593b0f3e543792248935e580ab6972db2aba5906aa08213ddd','2026-09-30 17:20:04.060','20260930140000_add_admin_login_and_access_area','',NULL,'2026-09-30 17:20:04.060',0),('fd8479c3-1ca1-4d54-a06f-b18b43a39184','8ecaf2f2950b9a5440b26ff4f4d2cee223c83c8158df06d94a45c3cf038f1aac','2026-10-01 12:14:21.182','20260930170000_add_item_catalog_fields',NULL,NULL,'2026-10-01 12:14:21.034',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `auditorias`
--

DROP TABLE IF EXISTS `auditorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditorias` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `acao` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alvoId` int NOT NULL,
  `autorId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `auditorias_alvoId_idx` (`alvoId`),
  KEY `auditorias_autorId_idx` (`autorId`),
  KEY `auditorias_createdAt_idx` (`createdAt`),
  CONSTRAINT `auditorias_autorId_fkey` FOREIGN KEY (`autorId`) REFERENCES `funcionarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `auditorias`
--

LOCK TABLES `auditorias` WRITE;
/*!40000 ALTER TABLE `auditorias` DISABLE KEYS */;
INSERT INTO `auditorias` VALUES ('08b4eb1b-bd20-4673-979b-16266a388b7e','USUARIO_DESATIVADO',4,24,'2026-09-30 19:35:17.807'),('52e3bba6-4218-4025-9673-69832bd35fb7','USUARIO_CRIADO',26,24,'2026-09-30 19:41:19.901'),('5825f9f7-2297-4e0b-9816-e6e1d8eb237f','USUARIO_CRIADO',25,24,'2026-09-30 13:08:02.908');
/*!40000 ALTER TABLE `auditorias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deposito_itens`
--

DROP TABLE IF EXISTS `deposito_itens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deposito_itens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `estoqueItemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantidade` int NOT NULL DEFAULT '0',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `deposito_itens_estoqueItemId_key` (`estoqueItemId`),
  KEY `deposito_itens_quantidade_idx` (`quantidade`),
  CONSTRAINT `deposito_itens_estoqueItemId_fkey` FOREIGN KEY (`estoqueItemId`) REFERENCES `estoque_itens` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `deposito_itens_quantidade_check` CHECK ((`quantidade` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deposito_itens`
--

LOCK TABLES `deposito_itens` WRITE;
/*!40000 ALTER TABLE `deposito_itens` DISABLE KEYS */;
INSERT INTO `deposito_itens` VALUES ('2887119b-0b61-4e7e-8414-32fdb7663632','ddf3f9a4-2754-4621-b48d-9686f2ec240c',209,'2026-09-30 19:37:14.327','2026-10-01 12:38:45.898'),('88c32773-34d3-4c63-8548-f54aeee0b860','b474dbb5-3969-4f71-82a1-691aaa1a5eee',10,'2026-10-01 12:32:52.131','2026-10-01 12:32:52.131');
/*!40000 ALTER TABLE `deposito_itens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estoque_itens`
--

DROP TABLE IF EXISTS `estoque_itens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estoque_itens` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nome` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `categoria` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unidade` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unidade',
  `quantidade` int NOT NULL DEFAULT '0',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `tipoUnidade` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unidade',
  `quantidadePorEmbalagem` int NOT NULL DEFAULT '1',
  `ultimaEntradaEmbalagens` int DEFAULT NULL,
  `tipoItem` enum('COMPONENTE','CONSUMIVEL','MATERIA_PRIMA','EMBALAGEM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CONSUMIVEL',
  `codigo` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filial` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grupoErp` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pontoPedido` int NOT NULL DEFAULT '0',
  `estoqueSeguranca` int NOT NULL DEFAULT '0',
  `bloqueadoCompra` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `estoque_itens_filial_codigo_key` (`filial`,`codigo`),
  KEY `estoque_itens_categoria_idx` (`categoria`),
  KEY `estoque_itens_ativo_idx` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estoque_itens`
--

LOCK TABLES `estoque_itens` WRITE;
/*!40000 ALTER TABLE `estoque_itens` DISABLE KEYS */;
INSERT INTO `estoque_itens` VALUES ('b474dbb5-3969-4f71-82a1-691aaa1a5eee','Porca Dupla / Alta','Porcas','peças',29,1,'2026-09-30 19:28:52.678','2026-10-01 12:32:52.117','caixa',12,2,'CONSUMIVEL',NULL,NULL,NULL,0,0,0),('ddf3f9a4-2754-4621-b48d-9686f2ec240c','Parafuso Sextavado (Aço Carbono / Inox)','Parafusos','peças',1,1,'2026-09-30 19:19:31.457','2026-10-01 12:38:45.894','unidade',1,100,'CONSUMIVEL',NULL,NULL,NULL,0,0,0);
/*!40000 ALTER TABLE `estoque_itens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `funcionarios`
--

DROP TABLE IF EXISTS `funcionarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `funcionarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nome` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `senha` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cargo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cracha` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `mustChangePassword` tinyint(1) NOT NULL DEFAULT '0',
  `ativo` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `cracha` (`cracha`),
  UNIQUE KEY `login` (`login`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `funcionarios`
--

LOCK TABLES `funcionarios` WRITE;
/*!40000 ALTER TABLE `funcionarios` DISABLE KEYS */;
INSERT INTO `funcionarios` VALUES (1,'João Silva','joao.silva@marcon.com','123456','almoxarife','MAR001',NULL,'user',0,1),(2,'Maria Santos','maria.santos@marcon.com','123456','almoxarife','MAR002',NULL,'user',0,1),(3,'Pedro Oliveira','pedro.oliveira@marcon.com','123456','almoxarife','MAR003',NULL,'user',0,1),(4,'Ana Souza','ana.souza@marcon.com','123456','almoxarife','MAR004',NULL,'user',0,0),(5,'Lucas Pereira','lucas.pereira@marcon.com','123456','almoxarife','MAR005',NULL,'user',0,1),(6,'Julia Costa','julia.costa@marcon.com','123456','operador','MAR006',NULL,'user',0,1),(7,'Gabriel Rodrigues','gabriel.rodrigues@marcon.com','123456','operador','MAR007',NULL,'user',0,1),(8,'Beatriz Almeida','beatriz.almeida@marcon.com','123456','operador','MAR008',NULL,'user',0,1),(9,'Rafael Ferreira','rafael.ferreira@marcon.com','123456','operador','MAR009',NULL,'user',0,1),(10,'Larissa Gomes','larissa.gomes@marcon.com','123456','operador','MAR010',NULL,'user',0,1),(11,'Teste Integracao','teste1790251601@marcon.local','$2b$12$F72JcPdlSiGTLzMswgz3NON2O/lFgWV1QHt6YY/MQcklHBBgQFHGu','operador','TEST1790251601',NULL,'user',0,1),(12,'Biel Isolado','biel-isolado@example.com','$2b$12$IZO.pNL4Ko1/PrtqlaYqO.XhgHK.9vIJHCdGuI93i4MIy.Z6f6rFG','almoxarife','ISO001',NULL,'user',0,1),(13,'biel','biel4941@gmiakd.com','$2b$12$eOoLw4VOMmjKM83KOy2fyO3V4g4abuGWh8tmI3NCL8L97ORWvEzP2','operador','MAR022',NULL,'user',0,1),(14,'Pablo Marcom','palbomarcon@gmail.com','$2b$12$rNErusV/5t0wx/jwdLkpte4pIDetYHAcnRydUf5RspwK9/weiKGZK','operador','2333',NULL,'user',0,1),(15,'erickoso','erickoso@gmail.com','$2b$12$EY4OH/D0z6Cti0PBrkcBk.Uo.F0t9/ZwrNw7q5l9ey2hUZv9QMxk2','almoxarife','110011',NULL,'user',0,1),(16,'gqaafja[','biel49142gamfi@gsanmgao.com','$2b$12$g2TMU2z0C03xNWIDZrSRp.VD5cHsswoNPPdnIyEmSdiJUjfDwN1yi','operador','1I41041',NULL,'user',0,1),(17,'biro','biro@gmail.com','$2b$12$So7g4AoVPLhABKwtRd65Leej56OmYLjPuD2Wk6jfRTTv8bUP7qF3O','operador','12',NULL,'user',0,1),(18,'Teste Auth','auth1790255557@example.com','$2b$12$cno2JEvjKe51.65x6Q66Gu8Gk97YamNr.hGfSlbpvgv8JZgR0Z3Eu','operador','AUTH1790255557',NULL,'user',0,1),(19,'Fluxo Auth','fluxo1790255670570@example.com','$2b$12$k7wQxC2QwVcwDkLSqZgNK.KHtktrysb9n7z1VoZztALexkj7JiJ7.','operador','FLUXO1790255670570',NULL,'user',0,1),(20,'biro','biro222@gmail.com','$2b$12$8N6oX/rnJ81LGcQR6uMLd.U4Yjo8k3ZtY848nxBSxnHdasEOPH.lO','operador','MAR1000',NULL,'user',0,1),(21,'BIRO','birowski@gmail.com','$2b$12$3e7u39chhjZdAhw96hzH7.POMQ0jqEQiYZ4/EjYNWRRINTV7HV1YO','almoxarife','10',NULL,'user',0,1),(22,'MIRELOVSKI','mirelovski@gmail.com','$2b$12$J66GGgxIJO5kjMmtK7KuIOKqStZneQdMasDPGSsFSBMOpw4IqDvty','operador','MAR023',NULL,'user',0,1),(23,'MARIA SILVA','maria@gmail.com','$2b$12$hEF7b.31LsQbatLHCTxFD.NGuxBTbfxf4EVJMDBhdGZqyOTkh0ns2','operador','MAR011',NULL,'user',0,1),(24,'Administrador','admin@local.invalid','$2b$12$Ywm.N7jpRcAWJ7y6ePkvAuZnQrAibqjYcRey/mpvCMAnWKRTg9iyq','admin','ADMIN','admin','admin',0,1),(25,'gabriel','1021213@local.invalid','$2b$12$fQJ/hBCsPO/LxJWnpgCSre4Hs8DvAiMvEAk5tABP1Pw97d0oPLwlS','operador','1021213',NULL,'user',1,1),(26,'kauanny','1234567@local.invalid','$2b$12$wLbGl3uzb5nT/CJttcqWmeRKu598957DXma8PRLEX3G/pJ8MroyZC','operador','1234567',NULL,'user',1,1);
/*!40000 ALTER TABLE `funcionarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `movimentacoes_deposito`
--

DROP TABLE IF EXISTS `movimentacoes_deposito`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimentacoes_deposito` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `itemId` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo` enum('SAIDA_REQUISICAO','ENTRADA_SOBRA','ENTRADA_MANUAL','AJUSTE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantidade` int NOT NULL,
  `saldoAntes` int NOT NULL,
  `saldoDepois` int NOT NULL,
  `requisicaoId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `usuarioId` int NOT NULL,
  `motivo` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotencyKey` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `criadoEm` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `movimentacoes_deposito_idempotencyKey_key` (`idempotencyKey`),
  KEY `movimentacoes_deposito_itemId_criadoEm_idx` (`itemId`,`criadoEm`),
  KEY `movimentacoes_deposito_tipo_criadoEm_idx` (`tipo`,`criadoEm`),
  KEY `movimentacoes_deposito_usuarioId_criadoEm_idx` (`usuarioId`,`criadoEm`),
  KEY `movimentacoes_deposito_requisicaoId_idx` (`requisicaoId`),
  CONSTRAINT `movimentacoes_deposito_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `estoque_itens` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `movimentacoes_deposito_requisicaoId_fkey` FOREIGN KEY (`requisicaoId`) REFERENCES `requisicao` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `movimentacoes_deposito_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `funcionarios` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `movimentacoes_deposito_quantidade_check` CHECK ((`quantidade` > 0)),
  CONSTRAINT `movimentacoes_deposito_saldos_check` CHECK (((`saldoAntes` >= 0) and (`saldoDepois` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `movimentacoes_deposito`
--

LOCK TABLES `movimentacoes_deposito` WRITE;
/*!40000 ALTER TABLE `movimentacoes_deposito` DISABLE KEYS */;
INSERT INTO `movimentacoes_deposito` VALUES ('7ef02f1b-b22a-4023-9d12-56b9371230ff','ddf3f9a4-2754-4621-b48d-9686f2ec240c','ENTRADA_MANUAL',99,110,209,NULL,24,'Contagem inicial do depósito','98277fdf-4413-409a-be29-bde6c20b7107','2026-10-01 12:38:45.901'),('c2c777aa-cebb-4149-9b44-e9728df1946a','ddf3f9a4-2754-4621-b48d-9686f2ec240c','ENTRADA_MANUAL',100,10,110,NULL,24,'Sobra sem requisição registrada','a9376aaa-839d-418f-920b-680bbbf9944e','2026-10-01 12:38:23.990'),('d5773f10-2125-49ee-adb0-dd623471040d','ddf3f9a4-2754-4621-b48d-9686f2ec240c','ENTRADA_MANUAL',10,0,10,NULL,24,'Sobra sem requisição registrada','65b41ae5-b909-4e5d-85c0-a3b9bfb8727f','2026-10-01 12:23:20.428'),('f122005b-8acf-4dde-a96d-baa0987bd4be','b474dbb5-3969-4f71-82a1-691aaa1a5eee','ENTRADA_MANUAL',10,0,10,NULL,24,'Contagem inicial do depósito','b6358bbd-5028-4c5e-9624-bf799a0cbaa8','2026-10-01 12:32:52.135');
/*!40000 ALTER TABLE `movimentacoes_deposito` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `requisicao`
--

DROP TABLE IF EXISTS `requisicao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `requisicao` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `item` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantidade` int NOT NULL,
  `observacao` text COLLATE utf8mb4_unicode_ci,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDENTE',
  `funcionarioId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) NOT NULL,
  `origem` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ESTOQUE',
  `numero` int NOT NULL AUTO_INCREMENT,
  `estoqueItemId` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qtdDevolvida` int NOT NULL DEFAULT '0',
  `origem_retirada` enum('DEPOSITO','ESTOQUE') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `idempotencyKey` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grupoIdempotencia` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Requisicao_numero_key` (`numero`),
  UNIQUE KEY `Requisicao_idempotencyKey_key` (`idempotencyKey`),
  KEY `Requisicao_funcionarioId_idx` (`funcionarioId`),
  KEY `Requisicao_status_idx` (`status`),
  KEY `Requisicao_grupoIdempotencia_idx` (`grupoIdempotencia`),
  KEY `Requisicao_estoqueItemId_fkey` (`estoqueItemId`),
  CONSTRAINT `Requisicao_estoqueItemId_fkey` FOREIGN KEY (`estoqueItemId`) REFERENCES `estoque_itens` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `Requisicao_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `Requisicao_qtdDevolvida_check` CHECK (((`qtdDevolvida` >= 0) and (`qtdDevolvida` <= `quantidade`)))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `requisicao`
--

LOCK TABLES `requisicao` WRITE;
/*!40000 ALTER TABLE `requisicao` DISABLE KEYS */;
INSERT INTO `requisicao` VALUES ('fe45fde4-ea17-4456-b21d-59d52a737ca8','Caneta de teste',2,'Smoke test','PENDENTE',11,'2026-09-24 12:06:47.160','2026-09-24 12:06:47.160','ESTOQUE',1,NULL,0,NULL,NULL,NULL);
/*!40000 ALTER TABLE `requisicao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessao`
--

DROP TABLE IF EXISTS `sessao`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessao` (
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `funcionarioId` int NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `accessArea` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Sessao_token_key` (`token`),
  KEY `Sessao_funcionarioId_idx` (`funcionarioId`),
  KEY `Sessao_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `Sessao_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessao`
--

LOCK TABLES `sessao` WRITE;
/*!40000 ALTER TABLE `sessao` DISABLE KEYS */;
INSERT INTO `sessao` VALUES ('0c7fa363-71dd-4ed8-ab9e-4bcf4c5e0d32','2f2cd5cdbda9d982063c6eb522ad5c238f5f7a07713c654e72722cd0e2f64e35','2026-10-01 18:39:25.642',24,'2026-10-01 10:39:25.650','admin'),('24dd9679-2b3c-44f0-8c88-07f163660f4a','9892551fa4dfb06c32e8e6d11831a489be994a277b7b60a0e593693b25ddc0cd','2026-10-01 03:41:40.878',26,'2026-09-30 19:41:40.880','almoxarifado'),('4ac3942f-b7f7-4b1e-a681-30bceaefce74','d98b026082441b6650d496304fcf4b66f98b779474ad3eb228e153cc443c9877','2026-09-24 21:12:38.118',18,'2026-09-24 13:12:38.121',NULL),('5982caf4-aaa6-48d0-b69d-6492cfc92bbe','5fe6b9ab64b642daa7f416ff21aa332cf2088b64cbc7e7bb73ae30e3e3fe9915','2026-09-24 20:06:47.102',11,'2026-09-24 12:06:47.105',NULL),('8696d400-6144-4c48-bef7-0298d386931d','8756601d3fc9f895402689501062acd0cb5fe9389dd3b0759468847413d409ab','2026-09-24 21:16:27.223',21,'2026-09-24 13:16:27.226',NULL),('917ce515-e911-4c2a-a32a-10927d43a9f8','e7ff057320b73fb2488b4fefe59c66e56dee3041c0728caf08365027d2998f56','2026-09-24 21:24:46.946',23,'2026-09-24 13:24:46.950',NULL),('bb427f47-604c-4dcf-816d-cdc69385065f','92c294fdd96a332df6c303af2cdbfbee1e5fc4494a45d3b42149cc397e9b3f58','2026-10-01 19:56:26.890',24,'2026-10-01 11:56:26.893','admin'),('de295778-9ad8-4611-af1c-fbebd16bbab0','60b7e8375eadc8347587673fe84ec4a755d1812173bac3c2e536e15434d88e90','2026-09-24 21:12:38.423',18,'2026-09-24 13:12:38.425',NULL),('f62e9a14-fb1e-4434-8b6a-40ca2e7461d0','43a24b6712c458c98d4fde36c6077435696b471a3fcf8c74c466500855388070','2026-10-01 01:59:55.138',24,'2026-09-30 17:59:55.148','admin');
/*!40000 ALTER TABLE `sessao` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'marcon_almox'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-01 11:02:47
