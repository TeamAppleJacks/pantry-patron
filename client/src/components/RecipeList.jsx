import React from 'react';

class RecipeList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      item: ''
    }
  }

  render() {
    // console.log('from recipelist', this.props.hit.recipe)
    return (
      <div className="each-recipe">
        <a href={this.props.hit.recipe.url} target="_blank"><p className="recipe-title">{this.props.hit.recipe.label}</p></a>
        <a href={this.props.hit.recipe.url} target="_blank"><img src={this.props.hit.recipe.image} className="recipe-pic"/></a>
        <br /><br />
        <p className="recipe-type">
          <b>Diet:</b> {this.props.hit.recipe.dietLabels.join(', ')}<br />
          <b>Health:</b> {this.props.hit.recipe.healthLabels.join(', ')}</p>
        <ul className="recipe-ingredients">
          {this.props.hit.recipe.ingredientLines.map(eachIngredient => <li>{eachIngredient}</li>)}
        </ul>
        <p><b><a href={this.props.hit.recipe.url} target="_blank">Step-by-step instructions here</a></b></p>
      </div>
    )
  }
}

export default RecipeList;
