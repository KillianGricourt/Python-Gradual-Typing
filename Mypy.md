# Mypy

Il semble y avoir un autre module de microsoftavec le même fonctionnement -> Pylance

## Fonctionnement

### Théorie
Mypy semble avoir type and programming language comme inspiration. 
J'ai exploré le code rapidement et je n'ai pas retrouvé les bases du l-calcul
J'ai l'impression que les types sont inférés directement dans les expressions sans descendre jusqu'au lambda-calcul.
Cela nécessite de déterminer des règles de typage pour toutes les expressions et syntaxes existantes.
utiliser du lambda calcul pure pourrait éviter de définir tous ces cas manuellement mais il faudrait à la place définir des règle pour convertir la sémantique de python vers une sémantique de l-calcul pure.
Est-ce que ça vaut le coup ? 

## Limitations

Mypy semble avoir du mal avec les types dans les appels à eval().

Pour générer les types, mypy a besoin que le développeur annote explicitement les expressions en fonction des vérification qu'il veut faire.
Seule une inférnce sur des cas évident est faite automatiquement (à la déclaration).
Si une expression n'est pas typé, mypy ne fait pas vérification et considère que l'expression est dynamique.

Il y a d'autre frame work qui génèrent les annotations

- MonkeyType : exécute le code et récupère les information lors des différents appels.
- AutoTyping : basé sur une librairie qui produits des annotations en exécutant le code.
- PyAnnotate : exécute le code et récupère les information lors des différents appels.

## Modifications possibles

Je pense qu'il est possible de vérifier le type statiquement sans demander au développeur d'ajouter manuellement les types.
Il y aura toujours des cas ou il est impossible de déduire les type depuis le code mais une des possibilités serait de les identifier et de proposer au développeur de le typer manuellement.


## Problème
Le framework pyright semble déjà le faire
J'ai pu trouver un exemple ne fonctionnant pas sous pyright mais je pense que le type peut être inféré de part son usage

```Python
def test(a):
    return a + 3
```
Le type inféré est `Any -> Any` ce qui semble montrer que pyright n'est pas en mesure de déduire le type `int` pour le paramètre `a`

de la même façon, mypy et pyright sont incapables de gérer tout seul les types de eval(), pour eux, le programme:
```py
e : list = eval("12+5")
print(e[0])
```
est correctement typé.

Pourtant lors de l'exécution, un TypeError est levé


pyright semble être plus général que mypy donc je vais me concentrer uniquement sur ce dernier.

