-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : sam. 13 déc. 2025 à 16:27
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `bot_students`
--

DELIMITER $$
--
-- Fonctions
--
CREATE DEFINER=`root`@`localhost` FUNCTION `LEVENSHTEIN` (`s1` VARCHAR(255), `s2` VARCHAR(255)) RETURNS INT(11) DETERMINISTIC BEGIN
  DECLARE s1_len, s2_len, i, j, cost, lastdiag, olddiag INT;
  DECLARE s1_char CHAR;
  DECLARE cv0, cv1 BLOB;

  SET s1_len = CHAR_LENGTH(s1);
  SET s2_len = CHAR_LENGTH(s2);
  IF s1_len = 0 THEN RETURN s2_len; END IF;
  IF s2_len = 0 THEN RETURN s1_len; END IF;

  SET cv1 = 0x00;
  SET j = 1;
  WHILE j <= s2_len DO
    SET cv1 = CONCAT(cv1, CHAR(j));
    SET j = j + 1;
  END WHILE;

  SET i = 1;
  WHILE i <= s1_len DO
    SET s1_char = SUBSTRING(s1, i, 1);
    SET cv0 = CHAR(i);
    SET j = 1;
    WHILE j <= s2_len DO
      SET cost = IF(s1_char = SUBSTRING(s2, j, 1), 0, 1);
      SET olddiag = ORD(SUBSTRING(cv1, j, 1));
      SET cv0 = CONCAT(cv0, CHAR(LEAST(ORD(SUBSTRING(cv1, j+1, 1))+1, ORD(SUBSTRING(cv0, j, 1))+1, olddiag+cost)));
      SET j = j + 1;
    END WHILE;
    SET cv1 = cv0;
    SET i = i + 1;
  END WHILE;
  RETURN ORD(SUBSTRING(cv1, s2_len+1, 1));
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Structure de la table `distination`
--

CREATE TABLE `distination` (
  `matricule` int(7) DEFAULT NULL,
  `destination` varchar(20) DEFAULT NULL,
  `created_in` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `distination`
--

-- --------------------------------------------------------

--
-- Structure de la table `eleve`
--

CREATE TABLE `eleve` (
  `nom` varchar(20) NOT NULL,
  `prenom` varchar(20) NOT NULL,
  `wilaya` varchar(10) DEFAULT NULL,
  `groupe` enum('A','B','C','D','E','F') DEFAULT NULL,
  `matricule` int(7) NOT NULL,
  `current_destination` varchar(10) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `token` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `eleve`
--

INSERT INTO `eleve` (`nom`, `prenom`, `wilaya`, `groupe`, `matricule`, `current_destination`, `username`, `token`) VALUES
('test', 'test', 'test', 'A', 334, 'test', 'usertest', 'qlfkjvnldkfvnd;jkfvndk:f'),



-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `username` varchar(100) NOT NULL,
  `token` varchar(100) DEFAULT NULL,
  `matricule` int(7) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`username`, `token`, `matricule`) VALUES
('usertest', 'qlfkjvnldkfvnd;jkfvndk:f', 334);

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `distination`
--
ALTER TABLE `distination`
  ADD UNIQUE KEY `uniq_matricule_date` (`matricule`,`created_in`);

--
-- Index pour la table `eleve`
--
ALTER TABLE `eleve`
  ADD PRIMARY KEY (`matricule`);
ALTER TABLE `eleve` ADD FULLTEXT KEY `full_name_index` (`nom`,`prenom`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`username`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `eleve`
--
ALTER TABLE `eleve`
  MODIFY `matricule` int(7) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=446;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `distination`
--
ALTER TABLE `distination`
  ADD CONSTRAINT `fk_distination_eleve` FOREIGN KEY (`matricule`) REFERENCES `eleve` (`matricule`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
